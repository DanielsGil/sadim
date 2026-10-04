import threading
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import ConfiguracionModulo, ConfiguracionPago
from servicios.models import Abono, OrdenTrabajo
from usuarios.models import Usuario
from ventas.models import Venta

from .models import CierreCaja, MovimientoCaja

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    test.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})


class FinanzasAPITestCase(TestCase):
    """Base común: ADMIN y OPERADOR autenticados, configuración de pagos habilitada."""

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

    def _crear_venta_confirmada(self, valor=Decimal('150000.00'), medio_pago='EFECTIVO'):
        ahora = timezone.now()
        estado_pago = Venta.EstadoPago.CONFIRMADO if medio_pago == 'EFECTIVO' else Venta.EstadoPago.PENDIENTE_VERIFICACION
        venta = Venta.objects.create(
            tipo=Venta.Tipo.RAPIDA, usuario=self.admin, estado=Venta.Estado.CERRADA,
            medio_pago=medio_pago, estado_pago=estado_pago, total=valor,
            fecha_apertura=ahora, fecha_cierre=ahora,
        )
        movimiento = MovimientoCaja.objects.create(
            usuario=self.admin, venta=venta, tipo=MovimientoCaja.Tipo.INGRESO_VENTA,
            medio_pago=medio_pago, estado_pago=estado_pago, valor=valor,
            fecha=ahora, fecha_confirmacion=ahora if estado_pago == 'CONFIRMADO' else None,
        )
        return venta, movimiento

    def _crear_venta_pendiente(self, valor=Decimal('50000.00')):
        return self._crear_venta_confirmada(valor=valor, medio_pago='TRANSFERENCIA')

    def _crear_orden(self, costo_total=Decimal('100000.00')):
        return OrdenTrabajo.objects.create(
            usuario=self.admin, cliente_nombre='Laura Méndez', descripcion='Torta de chocolate',
            fecha_entrega_estimada=timezone.localdate(), costo_total=costo_total,
            saldo_pendiente=costo_total, utilidad_neta=costo_total,
        )

    def _crear_abono_pendiente(self, orden, valor=Decimal('26000.00')):
        ahora = timezone.now()
        abono = Abono.objects.create(
            orden=orden, usuario=self.admin, valor=valor, medio_pago=Abono.MedioPago.TRANSFERENCIA,
            estado_pago=Abono.EstadoPago.PENDIENTE_VERIFICACION, fecha=ahora,
        )
        orden.saldo_pendiente -= valor
        orden.save(update_fields=['saldo_pendiente'])
        movimiento = MovimientoCaja.objects.create(
            usuario=self.admin, abono=abono, tipo=MovimientoCaja.Tipo.INGRESO_ABONO,
            medio_pago='TRANSFERENCIA', estado_pago=MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION,
            valor=valor, fecha=ahora,
        )
        return abono, movimiento


class GastoTests(FinanzasAPITestCase):
    """HU-029 (Contrato v2 §10, CU-14): POST /api/movimientos-caja/, solo GASTO."""

    def _payload(self, **overrides):
        payload = {
            'operation_id': str(uuid.uuid4()), 'tipo': 'GASTO', 'medio_pago': 'EFECTIVO',
            'valor': '3500.00', 'concepto': 'Compra de bolsas',
        }
        payload.update(overrides)
        return payload

    def test_gasto_efectivo_queda_confirmado(self):
        response = self.c_operador.post('/api/movimientos-caja/', self._payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado_pago'], 'CONFIRMADO')
        self.assertIsNotNone(response.data['fecha_confirmacion'])

    def test_gasto_transferencia_queda_pendiente(self):
        response = self.c_admin.post(
            '/api/movimientos-caja/', self._payload(medio_pago='TRANSFERENCIA'), format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado_pago'], 'PENDIENTE_VERIFICACION')
        self.assertIsNone(response.data['fecha_confirmacion'])

    def test_concepto_obligatorio(self):
        response = self.c_admin.post('/api/movimientos-caja/', self._payload(concepto=''), format='json')
        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_medio_pago_no_habilitado_responde_400(self):
        pago = ConfiguracionPago.objects.obtener()
        pago.acepta_qr = False
        pago.save(update_fields=['acepta_qr'])

        response = self.c_admin.post('/api/movimientos-caja/', self._payload(medio_pago='QR'), format='json')
        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.post('/api/movimientos-caja/', self._payload(), format='json')
        self.assertEqual(response.status_code, 401)

    def test_operador_no_puede_ver_historico(self):
        response = self.c_operador.get('/api/movimientos-caja/')
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_admin_ve_historico_con_filtros(self):
        self.c_admin.post('/api/movimientos-caja/', self._payload(), format='json')
        response = self.c_admin.get('/api/movimientos-caja/?tipo=GASTO')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)


class ConfirmarTests(FinanzasAPITestCase):
    """HU-050 (Contrato v2 §10, P-02): PATCH /api/movimientos-caja/{id}/confirmar/."""

    def test_confirmar_ingreso_venta_actualiza_movimiento_y_venta(self):
        venta, movimiento = self._crear_venta_pendiente()
        response = self.c_operador.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado_pago'], 'CONFIRMADO')
        self.assertIsNotNone(response.data['fecha_confirmacion'])
        venta.refresh_from_db()
        self.assertEqual(venta.estado_pago, 'CONFIRMADO')

    def test_confirmar_ingreso_abono_actualiza_abono(self):
        orden = self._crear_orden()
        abono, movimiento = self._crear_abono_pendiente(orden)

        response = self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        abono.refresh_from_db()
        self.assertEqual(abono.estado_pago, 'CONFIRMADO')

    def test_confirmar_ya_confirmado_responde_409(self):
        _, movimiento = self._crear_venta_pendiente()
        self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')

        response = self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')
        self.assertEqual(response.status_code, 409)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PAGO_YA_CONFIRMADO')

    def test_anonimo_recibe_401(self):
        _, movimiento = self._crear_venta_pendiente()
        response = self.c_anonimo.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')
        self.assertEqual(response.status_code, 401)


class AnularTests(FinanzasAPITestCase):
    """D15: PATCH /api/movimientos-caja/{id}/anular/, solo ADMIN."""

    def test_admin_anula_ingreso_venta(self):
        venta, movimiento = self._crear_venta_pendiente()
        response = self.c_admin.patch(
            f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'El cliente nunca pagó'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado_pago'], 'ANULADO')
        venta.refresh_from_db()
        self.assertEqual(venta.estado_pago, 'ANULADO')

    def test_anular_abono_devuelve_saldo_a_la_orden_y_no_toca_inventario(self):
        orden = self._crear_orden(costo_total=Decimal('100000.00'))
        abono, movimiento = self._crear_abono_pendiente(orden, valor=Decimal('26000.00'))
        self.assertEqual(orden.saldo_pendiente, Decimal('74000.00'))

        response = self.c_admin.patch(
            f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'El pago nunca llegó'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        abono.refresh_from_db()
        orden.refresh_from_db()
        self.assertEqual(abono.estado_pago, 'ANULADO')
        self.assertEqual(orden.saldo_pendiente, Decimal('100000.00'))

    def test_operador_no_puede_anular(self):
        _, movimiento = self._crear_venta_pendiente()
        response = self.c_operador.patch(
            f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_anular_ya_confirmado_responde_409(self):
        _, movimiento = self._crear_venta_pendiente()
        self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')

        response = self.c_admin.patch(
            f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'PAGO_YA_CONFIRMADO')

    def test_motivo_obligatorio(self):
        _, movimiento = self._crear_venta_pendiente()
        response = self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/anular/', {}, format='json')
        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)

    def test_anulado_no_aparece_en_pendientes(self):
        _, movimiento = self._crear_venta_pendiente()
        self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'x'}, format='json')

        response = self.c_admin.get('/api/movimientos-caja/pendientes/')
        ids = {item['id'] for item in response.data}
        self.assertNotIn(str(movimiento.id), ids)


class ResumenTests(FinanzasAPITestCase):
    """HU-027 (Contrato v2 §10, CU-20): GET /api/movimientos-caja/resumen/?fecha=."""

    def test_resumen_incluye_confirmados_y_pendientes(self):
        self._crear_venta_confirmada(valor=Decimal('150000.00'), medio_pago='EFECTIVO')
        orden = self._crear_orden()
        self._crear_abono_pendiente(orden, valor=Decimal('26000.00'))
        self.c_admin.post('/api/movimientos-caja/', {
            'operation_id': str(uuid.uuid4()), 'tipo': 'GASTO', 'medio_pago': 'EFECTIVO',
            'valor': '3500.00', 'concepto': 'Bolsas',
        }, format='json')

        fecha = timezone.localdate().isoformat()
        response = self.c_admin.get(f'/api/movimientos-caja/resumen/?fecha={fecha}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ingresos_ventas'], Decimal('150000.00'))
        self.assertEqual(response.data['ingresos_abonos'], Decimal('26000.00'))
        self.assertEqual(response.data['gastos'], Decimal('3500.00'))
        self.assertEqual(response.data['pendiente_verificacion'], Decimal('26000.00'))

    def test_anulado_no_cuenta_en_el_resumen(self):
        _, movimiento = self._crear_venta_pendiente(valor=Decimal('50000.00'))
        self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'x'}, format='json')

        fecha = timezone.localdate().isoformat()
        response = self.c_admin.get(f'/api/movimientos-caja/resumen/?fecha={fecha}')
        self.assertEqual(response.data['ingresos_ventas'], Decimal('0'))

    def test_operador_no_puede_ver_resumen(self):
        fecha = timezone.localdate().isoformat()
        response = self.c_operador.get(f'/api/movimientos-caja/resumen/?fecha={fecha}')
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')


class CierreTests(FinanzasAPITestCase):
    """HU-028 (Contrato v2 §11, CU-15), D14."""

    def test_cierre_sin_diferencia(self):
        self._crear_venta_confirmada(valor=Decimal('150000.00'), medio_pago='EFECTIVO')
        self.c_admin.post('/api/movimientos-caja/', {
            'operation_id': str(uuid.uuid4()), 'tipo': 'GASTO', 'medio_pago': 'EFECTIVO',
            'valor': '3500.00', 'concepto': 'Bolsas',
        }, format='json')

        response = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': '146500.00', 'observaciones': 'Sin novedades',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['efectivo_esperado'], Decimal('146500.00'))
        self.assertEqual(response.data['diferencia'], Decimal('0'))
        self.assertEqual(response.data['total_neto'], Decimal('146500.00'))

    def test_diferencia_sin_observaciones_responde_400(self):
        response = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': '100.00',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_diferencia_con_observaciones_se_registra(self):
        response = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': '100.00', 'observaciones': 'Faltaron 100 en caja',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['diferencia'], Decimal('100.00'))

    def test_pago_confirmado_despues_entra_al_siguiente_cierre_aunque_su_fecha_sea_anterior(self):
        # D14: el criterio es "no incluido en ningún cierre todavía", no un
        # rango fijo de fechas.
        orden = self._crear_orden()
        abono, movimiento = self._crear_abono_pendiente(orden, valor=Decimal('26000.00'))
        fecha1 = timezone.localdate()

        r1 = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': fecha1.isoformat(), 'efectivo_contado': '0.00',
        }, format='json')
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r1.data['total_ingresos_abonos'], Decimal('0'))

        self.c_admin.patch(f'/api/movimientos-caja/{movimiento.id}/confirmar/', {}, format='json')

        r2 = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': (fecha1 + timedelta(days=1)).isoformat(),
            'efectivo_contado': '0.00',
        }, format='json')
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.data['total_ingresos_abonos'], Decimal('26000.00'))
        movimiento.refresh_from_db()
        self.assertEqual(str(movimiento.cierre_caja_id), r2.data['id'])

    def test_movimientos_quedan_asociados_al_cierre(self):
        venta, movimiento = self._crear_venta_confirmada(valor=Decimal('10000.00'), medio_pago='EFECTIVO')
        response = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': '10000.00',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        movimiento.refresh_from_db()
        self.assertEqual(str(movimiento.cierre_caja_id), response.data['id'])

    def test_periodo_inicio_igual_a_periodo_fin_no_rompe_el_cierre(self):
        # Bug real: dos timezone.now() muy seguidos (uno al crear el
        # movimiento, otro al calcular periodo_fin dentro de crear_cierre)
        # podían coincidir al microsegundo si el reloj del sistema operativo
        # no alcanzaba a avanzar entre una llamada y otra (más notorio en
        # Windows), violando el CHECK cierrecaja_periodo_fin_mayor y
        # reportando 409 CIERRE_YA_REALIZADO en vez de crear el cierre.
        venta, movimiento = self._crear_venta_confirmada(valor=Decimal('10000.00'), medio_pago='EFECTIVO')

        with mock.patch('finanzas.services.timezone.now', return_value=movimiento.fecha):
            response = self.c_admin.post('/api/cierres-caja/', {
                'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
                'efectivo_contado': '10000.00',
            }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertLess(response.data['periodo_inicio'], response.data['periodo_fin'])

    def test_operador_no_puede_cerrar_caja(self):
        response = self.c_operador.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': '0.00',
        }, format='json')
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_operador_no_puede_listar_cierres(self):
        response = self.c_operador.get('/api/cierres-caja/')
        self.assertEqual(response.status_code, 403)


class VistaPreviaCierreTests(FinanzasAPITestCase):
    """D28 (A5, F-4/CU-15): GET /api/cierres-caja/vista-previa/ — solo ADMIN, sin guardar nada."""

    URL = '/api/cierres-caja/vista-previa/'

    def _gasto(self, valor, medio_pago='EFECTIVO'):
        response = self.c_admin.post('/api/movimientos-caja/', {
            'operation_id': str(uuid.uuid4()), 'tipo': 'GASTO', 'medio_pago': medio_pago,
            'valor': valor, 'concepto': 'Bolsas',
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_vista_previa_coincide_con_lo_que_guarda_el_cierre(self):
        self._crear_venta_confirmada(valor=Decimal('150000.00'), medio_pago='EFECTIVO')
        _, movimiento_qr = self._crear_venta_confirmada(valor=Decimal('20000.00'), medio_pago='QR')
        self.c_admin.patch(f'/api/movimientos-caja/{movimiento_qr.id}/confirmar/', {
            'operation_id': str(uuid.uuid4()),
        }, format='json')
        self._gasto('3500.00')

        previa = self.c_admin.get(self.URL)
        self.assertEqual(previa.status_code, 200)
        self.assertEqual(CierreCaja.objects.count(), 0)  # no guarda nada
        cuerpo = previa.json()
        for campo in ('total_ingresos_ventas', 'total_gastos', 'total_neto', 'efectivo_esperado'):
            self.assertIsInstance(cuerpo[campo], (int, float))  # números JSON, no texto

        cierre = self.c_admin.post('/api/cierres-caja/', {
            'operation_id': str(uuid.uuid4()), 'fecha': timezone.localdate().isoformat(),
            'efectivo_contado': str(previa.data['efectivo_esperado']),
        }, format='json')
        self.assertEqual(cierre.status_code, 201)
        for campo in ('total_ingresos_ventas', 'total_ingresos_abonos', 'total_gastos', 'total_neto', 'efectivo_esperado'):
            self.assertEqual(previa.data[campo], cierre.data[campo], campo)
        self.assertEqual(cierre.data['diferencia'], Decimal('0'))
        self.assertEqual(previa.data['por_medio_pago']['QR'], Decimal('20000.00'))
        self.assertEqual(previa.data['cantidad_movimientos'], 3)

    def test_operador_recibe_403(self):
        response = self.c_operador.get(self.URL)
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_modulo_finanzas_desactivado_responde_403(self):
        ConfiguracionModulo.objects.update(finanzas_activo=False)
        response = self.c_admin.get(self.URL)
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'MODULO_DESACTIVADO')

    def test_sin_movimientos_devuelve_ceros(self):
        response = self.c_admin.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_neto'], Decimal('0'))
        self.assertEqual(response.data['efectivo_esperado'], Decimal('0'))
        self.assertEqual(response.data['cantidad_movimientos'], 0)
        self.assertEqual(
            response.data['por_medio_pago'],
            {'EFECTIVO': Decimal('0'), 'TRANSFERENCIA': Decimal('0'), 'QR': Decimal('0')},
        )
        self.assertLess(response.data['periodo_inicio'], response.data['periodo_fin'])

    def test_pago_pendiente_de_verificacion_no_aparece(self):
        self._crear_venta_pendiente(valor=Decimal('50000.00'))
        response = self.c_admin.get(self.URL)
        self.assertEqual(response.data['total_ingresos_ventas'], Decimal('0'))
        self.assertEqual(response.data['por_medio_pago']['TRANSFERENCIA'], Decimal('0'))
        self.assertEqual(response.data['cantidad_movimientos'], 0)

    def test_gasto_en_efectivo_reduce_efectivo_esperado(self):
        self._crear_venta_confirmada(valor=Decimal('40000.00'), medio_pago='EFECTIVO')
        self._gasto('6000.00')
        response = self.c_admin.get(self.URL)
        self.assertEqual(response.data['efectivo_esperado'], Decimal('34000.00'))
        self.assertEqual(response.data['total_gastos'], Decimal('6000.00'))
        # por_medio_pago son INGRESOS: el gasto no lo reduce.
        self.assertEqual(response.data['por_medio_pago']['EFECTIVO'], Decimal('40000.00'))


class ConcurrenciaCierreTests(TransactionTestCase):
    """
    D14: dos cierres simultáneos no pueden consolidar el mismo movimiento —
    select_for_update() serializa el acceso. TransactionTestCase porque
    necesita transacciones reales entre hilos (igual que
    ventas.tests.ConcurrenciaSesionesTests).
    """

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())

        ahora = timezone.now()
        for _ in range(3):
            venta = Venta.objects.create(
                tipo=Venta.Tipo.RAPIDA, usuario=self.admin, estado=Venta.Estado.CERRADA,
                medio_pago='EFECTIVO', estado_pago='CONFIRMADO', total=Decimal('1000.00'),
                fecha_apertura=ahora, fecha_cierre=ahora,
            )
            MovimientoCaja.objects.create(
                usuario=self.admin, venta=venta, tipo=MovimientoCaja.Tipo.INGRESO_VENTA,
                medio_pago='EFECTIVO', estado_pago='CONFIRMADO', valor=Decimal('1000.00'),
                fecha=ahora, fecha_confirmacion=ahora,
            )

    def test_dos_cierres_simultaneos_no_duplican_movimientos(self):
        cliente = APIClient()
        respuesta_login = cliente.post(
            '/api/auth/login/', {'username': 'admin1', 'password': PASSWORD}, format='json',
        )
        token = respuesta_login.data['access_token']
        fecha = timezone.localdate().isoformat()

        resultados = []
        barrera = threading.Barrier(2)

        def _cerrar():
            barrera.wait()
            cliente_hilo = APIClient()
            cliente_hilo.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
            try:
                respuesta = cliente_hilo.post('/api/cierres-caja/', {
                    'operation_id': str(uuid.uuid4()), 'fecha': fecha, 'efectivo_contado': '3000.00',
                }, format='json')
                resultados.append(respuesta.status_code)
            finally:
                connection.close()

        hilos = [threading.Thread(target=_cerrar) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        # El invariante que importa (D14) es que ningún movimiento se
        # consolide dos veces y que solo exista un CierreCaja para la fecha;
        # el código exacto que recibe la petición perdedora depende de si
        # alcanza a ver movimientos ya consolidados (400, diferencia propia)
        # o choca con el UNIQUE(fecha) (409) — ambos son seguros.
        self.assertEqual(resultados.count(201), 1)
        perdedor = [codigo for codigo in resultados if codigo != 201][0]
        self.assertIn(perdedor, (400, 409))
        self.assertEqual(CierreCaja.objects.filter(fecha=timezone.localdate()).count(), 1)
        cierre = CierreCaja.objects.get(fecha=timezone.localdate())
        self.assertEqual(cierre.movimientos.count(), 3)
