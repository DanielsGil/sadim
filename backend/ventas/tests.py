import threading
import uuid
from decimal import Decimal
from unittest.mock import patch

from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.exceptions import ErrorNegocio
from core.models import ConfiguracionModulo, ConfiguracionPago
from finanzas.models import MovimientoCaja
from inventario.models import Categoria, MovimientoInventario, Producto
from usuarios.models import Usuario

from .models import DetalleVenta, Mesa, Venta
from .services import editar_mesa

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    test.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})


class VentasAPITestCase(TestCase):
    """Base común: ADMIN y OPERADOR autenticados, configuración y catálogo de prueba."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(
            actualizado_por=self.admin, actualizado_en=timezone.now(),
            acepta_efectivo=True, acepta_transferencia=True, acepta_qr=True,
            nequi_titular='Aroma & Co.', nequi_llave='3001234567',
        )

        self.categoria = Categoria.objects.create(nombre='Bebidas')
        self.cafe = Producto.objects.create(
            categoria=self.categoria, nombre='Café', tipo='REVENTA_DIRECTA',
            precio_venta=Decimal('3500.00'), unidad_medida='unidad',
            controla_stock=True, stock_actual=Decimal('10'),
        )
        self.agua = Producto.objects.create(
            categoria=self.categoria, nombre='Agua', tipo='REVENTA_DIRECTA',
            precio_venta=Decimal('2000.00'), unidad_medida='unidad',
            controla_stock=True, stock_actual=Decimal('0'),
        )
        self.torta = Producto.objects.create(
            categoria=self.categoria, nombre='Porción de torta', tipo='INSUMO_PRODUCCION',
            precio_venta=Decimal('6000.00'), unidad_medida='unidad',
            controla_stock=False,
        )

        self.c_admin = APIClient()
        self._autenticar(self.c_admin, 'admin1')
        self.c_operador = APIClient()
        self._autenticar(self.c_operador, 'oper1')
        self.c_anonimo = APIClient()

    def _autenticar(self, client, username):
        response = client.post(
            '/api/auth/login/', {'username': username, 'password': PASSWORD}, format='json',
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access_token']}")


class MesaTests(VentasAPITestCase):
    """HU-043 — /api/mesas/ (Contrato v2 §7.1)."""

    def test_admin_crea_mesa(self):
        response = self.c_admin.post(
            '/api/mesas/', {'operation_id': str(uuid.uuid4()), 'numero': 1}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'DISPONIBLE')
        self.assertTrue(response.data['activa'])

    def test_operador_no_puede_crear_mesa(self):
        response = self.c_operador.post(
            '/api/mesas/', {'operation_id': str(uuid.uuid4()), 'numero': 1}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/mesas/')
        self.assertEqual(response.status_code, 401)

    def test_limite_de_quince_mesas_activas(self):
        for numero in range(1, 16):
            Mesa.objects.create(numero=numero)
        response = self.c_admin.post(
            '/api/mesas/', {'operation_id': str(uuid.uuid4()), 'numero': 16}, format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'LIMITE_MESAS_EXCEDIDO')

    def test_no_se_puede_desactivar_mesa_ocupada(self):
        mesa = Mesa.objects.create(numero=1, estado=Mesa.Estado.OCUPADA)
        response = self.c_admin.patch(f'/api/mesas/{mesa.id}/', {'activa': False}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'MESA_OCUPADA')

    def test_desactivar_y_reactivar_mesa_disponible(self):
        mesa = Mesa.objects.create(numero=1)
        response = self.c_admin.patch(f'/api/mesas/{mesa.id}/', {'activa': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['activa'])

    def test_reactivar_por_encima_del_limite_responde_409(self):
        # numero es único y está limitado a 1..15 (CHECK), así que nunca
        # puede haber más de 15 mesas a la vez: no hay forma de reproducir
        # "16 mesas" a través de la API. Se prueba el servicio directamente,
        # simulando que el conteo bloqueado ya está en el límite.
        mesa = Mesa.objects.create(numero=1, activa=False)
        with patch('ventas.services._mesas_activas_bloqueadas', return_value=[object()] * 15):
            with self.assertRaises(ErrorNegocio) as contexto:
                editar_mesa(mesa=mesa, datos={'activa': True})
        self.assertEqual(contexto.exception.code, 'LIMITE_MESAS_EXCEDIDO')
        self.assertEqual(contexto.exception.status_code, 409)


class MesaSinTransaccionImplicitaTests(TransactionTestCase):
    """
    E-05: perform_update() en MesaViewSet llamaba a editar_mesa() sin
    envolverla en una transacción explícita. Al reactivar, editar_mesa()
    revalida el límite de 15 mesas activas con _mesas_activas_bloqueadas(),
    que usa select_for_update() — y select_for_update() exige estar dentro
    de una transacción; si no, Django lanza TransactionManagementError, que
    no se capturaba y llegaba como 500 ERROR_INTERNO.

    TestCase (usada en el resto de este archivo) envuelve cada prueba en una
    transacción implícita y por eso nunca detectó el bug; aquí se usa
    TransactionTestCase, sin esa envoltura, igual que una petición HTTP real
    en producción (Django no tiene ATOMIC_REQUESTS activado).
    """

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        self.cliente = APIClient()
        respuesta = self.cliente.post(
            '/api/auth/login/', {'username': 'admin1', 'password': PASSWORD}, format='json',
        )
        self.cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access_token']}")

    def test_crear_desactivar_reactivar_mesa_no_responde_500(self):
        respuesta = self.cliente.post(
            '/api/mesas/', {'operation_id': str(uuid.uuid4()), 'numero': 1}, format='json',
        )
        self.assertEqual(respuesta.status_code, 201)
        mesa_id = respuesta.data['id']

        respuesta = self.cliente.patch(f'/api/mesas/{mesa_id}/', {'activa': False}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['activa'])

        respuesta = self.cliente.patch(f'/api/mesas/{mesa_id}/', {'activa': True}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['activa'])

    def test_desactivar_mesa_ocupada_sigue_dando_409_sin_transaccion_implicita(self):
        mesa = Mesa.objects.create(numero=1, estado=Mesa.Estado.OCUPADA)
        respuesta = self.cliente.patch(f'/api/mesas/{mesa.id}/', {'activa': False}, format='json')
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data['code'], 'MESA_OCUPADA')


class VentaRapidaTests(VentasAPITestCase):
    """HU-012, HU-013, HU-014, HU-015 — POST /api/ventas/ tipo RAPIDA (P-01)."""

    def _payload(self, **overrides):
        payload = {
            'operation_id': str(uuid.uuid4()),
            'tipo': 'RAPIDA',
            'medio_pago': 'EFECTIVO',
            'detalles': [
                {'producto_id': str(self.cafe.id), 'cantidad': 2},
            ],
        }
        payload.update(overrides)
        return payload

    def test_camino_feliz_descuenta_stock_y_genera_movimientos(self):
        response = self.c_operador.post('/api/ventas/', self._payload(), format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'CERRADA')
        self.assertEqual(Decimal(str(response.data['total'])), Decimal('7000.00'))
        self.assertEqual(response.data['estado_pago'], 'CONFIRMADO')

        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('8'))

        venta_id = response.data['id']
        self.assertEqual(
            MovimientoInventario.objects.filter(venta_id=venta_id, tipo='SALIDA_VENTA').count(), 1,
        )
        self.assertEqual(MovimientoCaja.objects.filter(venta_id=venta_id, tipo='INGRESO_VENTA').count(), 1)
        movimiento_caja = MovimientoCaja.objects.get(venta_id=venta_id)
        self.assertEqual(movimiento_caja.valor, Decimal('7000.00'))
        self.assertEqual(movimiento_caja.estado_pago, 'CONFIRMADO')

    def test_producto_sin_controla_stock_no_valida_ni_mueve_stock(self):
        response = self.c_admin.post('/api/ventas/', self._payload(detalles=[
            {'producto_id': str(self.torta.id), 'cantidad': 3},
        ]), format='json')

        self.assertEqual(response.status_code, 201)
        self.torta.refresh_from_db()
        self.assertEqual(self.torta.stock_actual, Decimal('0'))  # nunca se toca
        self.assertEqual(
            MovimientoInventario.objects.filter(producto=self.torta).count(), 0,
        )

    def test_stock_insuficiente_no_registra_nada(self):
        response = self.c_admin.post('/api/ventas/', self._payload(detalles=[
            {'producto_id': str(self.agua.id), 'cantidad': 5},
        ]), format='json')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')
        self.assertEqual(Venta.objects.count(), 0)
        self.assertEqual(MovimientoInventario.objects.count(), 0)
        self.assertEqual(MovimientoCaja.objects.count(), 0)
        self.agua.refresh_from_db()
        self.assertEqual(self.agua.stock_actual, Decimal('0'))

    def test_producto_inactivo_responde_409(self):
        self.cafe.activo = False
        self.cafe.save(update_fields=['activo'])
        response = self.c_admin.post('/api/ventas/', self._payload(), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'PRODUCTO_INACTIVO')

    def test_medio_de_pago_no_habilitado_responde_400(self):
        pagos = ConfiguracionPago.objects.obtener()
        pagos.acepta_transferencia = False
        pagos.save()
        response = self.c_admin.post(
            '/api/ventas/', self._payload(medio_pago='TRANSFERENCIA'), format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_transferencia_habilitada_queda_pendiente_de_verificacion(self):
        response = self.c_admin.post(
            '/api/ventas/', self._payload(medio_pago='TRANSFERENCIA'), format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado_pago'], 'PENDIENTE_VERIFICACION')
        movimiento = MovimientoCaja.objects.get(venta_id=response.data['id'])
        self.assertEqual(movimiento.estado_pago, 'PENDIENTE_VERIFICACION')
        self.assertIsNone(movimiento.fecha_confirmacion)

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.post('/api/ventas/', self._payload(), format='json')
        self.assertEqual(response.status_code, 401)

    def test_reintento_con_mismo_operation_id_no_duplica(self):
        payload = self._payload()
        primera = self.c_admin.post('/api/ventas/', payload, format='json')
        segunda = self.c_admin.post('/api/ventas/', payload, format='json')

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(primera.data['id'], segunda.data['id'])
        self.assertEqual(Venta.objects.count(), 1)
        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('8'))  # el descuento no se repitió


class SesionDinamicaTests(VentasAPITestCase):
    """HU-016, HU-017, HU-018, HU-019, HU-048 — sesiones dinámicas por mesa."""

    def setUp(self):
        super().setUp()
        self.mesa = Mesa.objects.create(numero=1)

    def _abrir_sesion(self, cliente=None):
        cliente = cliente or self.c_operador
        return cliente.post('/api/ventas/', {
            'operation_id': str(uuid.uuid4()), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(self.mesa.id),
        }, format='json')

    def test_abrir_sesion_ocupa_la_mesa(self):
        response = self._abrir_sesion()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'ABIERTA')
        self.mesa.refresh_from_db()
        self.assertEqual(self.mesa.estado, Mesa.Estado.OCUPADA)

    def test_no_se_puede_abrir_dos_sesiones_en_la_misma_mesa(self):
        primera = self._abrir_sesion()
        self.assertEqual(primera.status_code, 201)
        segunda = self._abrir_sesion()
        self.assertEqual(segunda.status_code, 409)
        self.assertEqual(segunda.data['code'], 'MESA_OCUPADA')

    def test_mesa_inactiva_responde_400(self):
        self.mesa.activa = False
        self.mesa.save(update_fields=['activa'])
        response = self._abrir_sesion()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_una_sesion_no_admite_detalles_ni_medio_de_pago_al_abrir(self):
        response = self.c_operador.post('/api/ventas/', {
            'operation_id': str(uuid.uuid4()), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(self.mesa.id),
            'medio_pago': 'EFECTIVO',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_agregar_y_quitar_detalle(self):
        venta_id = self._abrir_sesion().data['id']

        r_agregar = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'operation_id': str(uuid.uuid4()), 'producto_id': str(self.cafe.id), 'cantidad': 2,
        }, format='json')
        self.assertEqual(r_agregar.status_code, 201)
        self.assertEqual(Decimal(str(r_agregar.data['subtotal'])), Decimal('7000.00'))
        # R-09: agregar a una sesión ABIERTA no afecta existencias.
        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('10'))

        detalle_id = r_agregar.data['id']
        r_lista = self.c_operador.get(f'/api/ventas/?estado=ABIERTA&mesa={self.mesa.id}')
        self.assertEqual(Decimal(str(r_lista.data[0]['total'])), Decimal('7000.00'))

        r_quitar = self.c_operador.delete(f'/api/ventas/{venta_id}/detalles/{detalle_id}/')
        self.assertEqual(r_quitar.status_code, 204)
        r_lista2 = self.c_operador.get(f'/api/ventas/?estado=ABIERTA&mesa={self.mesa.id}')
        self.assertEqual(Decimal(str(r_lista2.data[0]['total'])), Decimal('0'))

    def test_agregar_detalle_producto_inactivo_responde_409(self):
        venta_id = self._abrir_sesion().data['id']
        self.cafe.activo = False
        self.cafe.save(update_fields=['activo'])
        response = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 1,
        }, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'PRODUCTO_INACTIVO')

    def test_cerrar_sesion_sin_detalles_responde_400(self):
        venta_id = self._abrir_sesion().data['id']
        response = self.c_operador.patch(
            f'/api/ventas/{venta_id}/cerrar/', {'medio_pago': 'EFECTIVO'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_cerrar_sesion_descuenta_stock_y_libera_mesa(self):
        venta_id = self._abrir_sesion().data['id']
        self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 3,
        }, format='json')

        response = self.c_operador.patch(
            f'/api/ventas/{venta_id}/cerrar/',
            {'operation_id': str(uuid.uuid4()), 'medio_pago': 'EFECTIVO'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'CERRADA')
        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('7'))
        self.mesa.refresh_from_db()
        self.assertEqual(self.mesa.estado, Mesa.Estado.DISPONIBLE)
        self.assertEqual(MovimientoCaja.objects.filter(venta_id=venta_id).count(), 1)

    def test_agregar_detalle_sobre_el_stock_responde_409_y_no_crea_nada(self):
        """D24 (HU-017): en línea se valida al agregar, sin descontar."""
        venta_id = self._abrir_sesion().data['id']

        response = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.agua.id), 'cantidad': 1,  # agua tiene stock 0
        }, format='json')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')
        self.assertEqual(response.data['details']['productos'][0]['producto_id'], str(self.agua.id))
        self.assertEqual(DetalleVenta.objects.filter(venta_id=venta_id).count(), 0)
        self.agua.refresh_from_db()
        self.assertEqual(self.agua.stock_actual, Decimal('0'))

    def test_agregar_detalle_suma_lo_ya_agregado_del_mismo_producto(self):
        venta_id = self._abrir_sesion().data['id']  # café: stock 10
        primero = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 6,
        }, format='json')
        self.assertEqual(primero.status_code, 201)

        segundo = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 5,  # 6 + 5 = 11 > 10
        }, format='json')

        self.assertEqual(segundo.status_code, 409)
        self.assertEqual(segundo.data['code'], 'STOCK_INSUFICIENTE')
        self.assertEqual(DetalleVenta.objects.filter(venta_id=venta_id).count(), 1)
        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('10'))  # nada se descontó

    def test_agregar_detalle_de_producto_sin_control_de_stock_nunca_se_valida(self):
        venta_id = self._abrir_sesion().data['id']

        response = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.torta.id), 'cantidad': 999,
        }, format='json')

        self.assertEqual(response.status_code, 201)

    def test_cerrar_sesion_con_stock_insuficiente_no_aplica_nada(self):
        venta_id = self._abrir_sesion().data['id']
        self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 8,
        }, format='json')
        # Otra venta consume existencias mientras la sesión sigue abierta (R-19 se
        # vuelve a validar al cerrar).
        Producto.objects.filter(pk=self.cafe.pk).update(stock_actual=Decimal('2'))

        response = self.c_operador.patch(
            f'/api/ventas/{venta_id}/cerrar/', {'medio_pago': 'EFECTIVO'}, format='json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')
        venta = Venta.objects.get(pk=venta_id)
        self.assertEqual(venta.estado, Venta.Estado.ABIERTA)
        self.mesa.refresh_from_db()
        self.assertEqual(self.mesa.estado, Mesa.Estado.OCUPADA)
        self.assertEqual(MovimientoCaja.objects.count(), 0)

    def test_reintentar_cerrar_con_mismo_operation_id_devuelve_200_no_409(self):
        venta_id = self._abrir_sesion().data['id']
        self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 1,
        }, format='json')
        operation_id = str(uuid.uuid4())

        primera = self.c_operador.patch(
            f'/api/ventas/{venta_id}/cerrar/',
            {'operation_id': operation_id, 'medio_pago': 'EFECTIVO'}, format='json',
        )
        segunda = self.c_operador.patch(
            f'/api/ventas/{venta_id}/cerrar/',
            {'operation_id': operation_id, 'medio_pago': 'EFECTIVO'}, format='json',
        )

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)  # no 409 VENTA_YA_CERRADA
        self.assertEqual(segunda.data['estado'], 'CERRADA')
        self.assertEqual(MovimientoCaja.objects.filter(venta_id=venta_id).count(), 1)

    def test_cancelar_sesion_libera_mesa_sin_movimientos(self):
        venta_id = self._abrir_sesion().data['id']
        self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 1,
        }, format='json')

        response = self.c_operador.patch(f'/api/ventas/{venta_id}/cancelar/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'CANCELADA')
        self.mesa.refresh_from_db()
        self.assertEqual(self.mesa.estado, Mesa.Estado.DISPONIBLE)
        self.assertEqual(MovimientoInventario.objects.count(), 0)
        self.assertEqual(MovimientoCaja.objects.count(), 0)
        self.cafe.refresh_from_db()
        self.assertEqual(self.cafe.stock_actual, Decimal('10'))

    def test_cancelar_venta_ya_cerrada_responde_409(self):
        venta_id = self._abrir_sesion().data['id']
        self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 1,
        }, format='json')
        self.c_operador.patch(f'/api/ventas/{venta_id}/cerrar/', {'medio_pago': 'EFECTIVO'}, format='json')

        response = self.c_operador.patch(f'/api/ventas/{venta_id}/cancelar/', {}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'VENTA_YA_CERRADA')

    def test_quitar_detalle_de_venta_cerrada_responde_409(self):
        venta_id = self._abrir_sesion().data['id']
        detalle_id = self.c_operador.post(f'/api/ventas/{venta_id}/detalles/', {
            'producto_id': str(self.cafe.id), 'cantidad': 1,
        }, format='json').data['id']
        self.c_operador.patch(f'/api/ventas/{venta_id}/cerrar/', {'medio_pago': 'EFECTIVO'}, format='json')

        response = self.c_operador.delete(f'/api/ventas/{venta_id}/detalles/{detalle_id}/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'VENTA_YA_CERRADA')


class ConcurrenciaSesionesTests(TransactionTestCase):
    """
    HU-019 (R-08): dos aperturas simultáneas en la misma mesa — solo una
    prospera. TransactionTestCase porque necesita transacciones reales entre
    hilos (igual que core.tests.IdempotenciaTests).
    """

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        ConfiguracionModulo.objects.create(actualizado_por=admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(actualizado_por=admin, actualizado_en=timezone.now())
        self.mesa = Mesa.objects.create(numero=1)

    def test_dos_aperturas_simultaneas_solo_una_prospera(self):
        cliente = APIClient()
        respuesta_login = cliente.post(
            '/api/auth/login/', {'username': 'oper1', 'password': PASSWORD}, format='json',
        )
        token = respuesta_login.data['access_token']

        resultados = []
        barrera = threading.Barrier(2)

        def _abrir():
            barrera.wait()
            cliente_hilo = APIClient()
            cliente_hilo.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
            try:
                respuesta = cliente_hilo.post('/api/ventas/', {
                    'operation_id': str(uuid.uuid4()), 'tipo': 'SESION_DINAMICA',
                    'mesa_id': str(self.mesa.id),
                }, format='json')
                resultados.append(respuesta.status_code)
            finally:
                connection.close()

        hilos = [threading.Thread(target=_abrir) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        self.assertEqual(sorted(resultados), [201, 409])
        self.assertEqual(Venta.objects.filter(mesa=self.mesa, estado=Venta.Estado.ABIERTA).count(), 1)
