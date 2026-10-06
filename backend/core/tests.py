import threading
import uuid
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.views import APIView

from usuarios.models import Usuario

from .exceptions import ErrorNegocio
from .idempotencia import ejecutar_con_idempotencia
from .models import ConfiguracionModulo, ConfiguracionPago, Dispositivo, OperacionSincronizacion
from .permissions import ModuloActivoPermission

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    test.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})


class ConfiguracionAPITestCase(TestCase):
    """Base común: ADMIN y OPERADOR autenticados (HU-042, HU-049)."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())

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


class ConfiguracionModuloTests(ConfiguracionAPITestCase):
    """HU-042 — GET y PATCH /api/configuracion/modulos/ (D-03)."""

    def test_admin_puede_leer_y_modificar(self):
        r_get = self.c_admin.get('/api/configuracion/modulos/')
        self.assertEqual(r_get.status_code, 200)
        self.assertTrue(r_get.data['ventas_activo'])

        r_patch = self.c_admin.patch(
            '/api/configuracion/modulos/', {'finanzas_activo': False}, format='json',
        )
        self.assertEqual(r_patch.status_code, 200)
        self.assertFalse(r_patch.data['finanzas_activo'])
        self.assertTrue(r_patch.data['ventas_activo'])  # los demás no cambian
        self.assertEqual(r_patch.data['actualizado_por_id'], self.admin.id)

        configuracion = ConfiguracionModulo.objects.obtener()
        self.assertFalse(configuracion.finanzas_activo)
        self.assertEqual(configuracion.actualizado_por_id, self.admin.id)

    def test_operador_puede_leer_pero_no_modificar(self):
        r_get = self.c_operador.get('/api/configuracion/modulos/')
        self.assertEqual(r_get.status_code, 200)

        r_patch = self.c_operador.patch(
            '/api/configuracion/modulos/', {'finanzas_activo': False}, format='json',
        )
        self.assertEqual(r_patch.status_code, 403)
        assert_error_shape(self, r_patch)
        self.assertEqual(r_patch.data['code'], 'PERMISO_INSUFICIENTE')

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/configuracion/modulos/')
        self.assertEqual(response.status_code, 401)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'NO_AUTENTICADO')


class ModuloActivoPermissionTests(TestCase):
    """
    HU-042 (P-04): la bandera bloquea con 403 MODULO_DESACTIVADO cualquier
    ViewSet que declare `modulo`, sin que cada uno reimplemente el chequeo.
    """

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        ConfiguracionModulo.objects.create(
            actualizado_por=self.admin, actualizado_en=timezone.now(), ventas_activo=False,
        )
        self.factory = APIRequestFactory()

    def test_bloquea_cuando_el_modulo_esta_desactivado(self):
        class VistaDeVentasDePrueba(APIView):
            modulo = 'ventas'
            permission_classes = [ModuloActivoPermission]

            def get(self, request):
                return Response({'ok': True})

        request = self.factory.get('/api/ventas/')
        request.user = self.admin
        response = VistaDeVentasDePrueba.as_view()(request)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'MODULO_DESACTIVADO')

    def test_no_bloquea_rutas_del_nucleo_sin_atributo_modulo(self):
        class VistaDeNucleoDePrueba(APIView):
            permission_classes = [ModuloActivoPermission]

            def get(self, request):
                return Response({'ok': True})

        request = self.factory.get('/api/categorias/')
        request.user = self.admin
        response = VistaDeNucleoDePrueba.as_view()(request)

        self.assertEqual(response.status_code, 200)


class ConfiguracionPagoTests(ConfiguracionAPITestCase):
    """HU-049 — GET y PATCH /api/configuracion/pagos/ (D-06)."""

    def test_admin_puede_leer_y_modificar(self):
        r_get = self.c_admin.get('/api/configuracion/pagos/')
        self.assertEqual(r_get.status_code, 200)
        self.assertTrue(r_get.data['acepta_efectivo'])
        self.assertFalse(r_get.data['acepta_transferencia'])

        r_patch = self.c_admin.patch('/api/configuracion/pagos/', {
            'acepta_transferencia': True,
            'nequi_titular': 'Aroma & Co.',
            'nequi_llave': '3001234567',
        }, format='json')

        self.assertEqual(r_patch.status_code, 200)
        self.assertTrue(r_patch.data['acepta_transferencia'])
        self.assertEqual(r_patch.data['nequi_llave'], '3001234567')
        self.assertEqual(r_patch.data['actualizado_por_id'], self.admin.id)

    def test_habilitar_transferencia_sin_llave_nequi_responde_400(self):
        response = self.c_admin.patch(
            '/api/configuracion/pagos/', {'acepta_transferencia': True}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')
        self.assertIn('nequi_llave', response.data['details'])

    def test_operador_puede_leer_pero_no_modificar(self):
        r_get = self.c_operador.get('/api/configuracion/pagos/')
        self.assertEqual(r_get.status_code, 200)

        r_patch = self.c_operador.patch(
            '/api/configuracion/pagos/', {'nequi_titular': 'Otro'}, format='json',
        )
        self.assertEqual(r_patch.status_code, 403)
        assert_error_shape(self, r_patch)
        self.assertEqual(r_patch.data['code'], 'PERMISO_INSUFICIENTE')

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/configuracion/pagos/')
        self.assertEqual(response.status_code, 401)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'NO_AUTENTICADO')


class RegistroCreaConfiguracionTests(TestCase):
    """D9: /api/auth/register/ crea ConfiguracionModulo y ConfiguracionPago."""

    def test_registro_crea_configuracion_modulo_y_pago(self):
        client = APIClient()
        response = client.post('/api/auth/register/', {
            'nombre_completo': 'Admin Uno', 'username': 'admin1', 'password': PASSWORD,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        admin_id = uuid.UUID(response.data['usuario_id'])

        modulos = ConfiguracionModulo.objects.obtener()
        pagos = ConfiguracionPago.objects.obtener()
        self.assertEqual(modulos.actualizado_por_id, admin_id)
        self.assertEqual(pagos.actualizado_por_id, admin_id)
        # D9: nace solo con efectivo, para no violar el CHECK de nequi_llave.
        self.assertTrue(pagos.acepta_efectivo)
        self.assertFalse(pagos.acepta_transferencia)
        self.assertFalse(pagos.acepta_qr)


class IdempotenciaTests(TransactionTestCase):
    """
    HU-045 — pruebas del mecanismo genérico a nivel de servicio, incluida la
    concurrencia (dos hilos con el mismo operation_id). TransactionTestCase
    porque necesita transacciones de verdad entre hilos; el efecto real que
    se protege es la creación de una Categoria (evita depender de un
    contador en memoria, que no es transaccional y no reflejaría un rollback).
    """

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )

    def _crear_categoria(self, contador, operation_id):
        from inventario.models import Categoria

        def _representar(categoria):
            return {'id': str(categoria.id), 'nombre': categoria.nombre}

        def _ejecutar():
            contador['veces'] += 1
            categoria = Categoria.objects.create(
                operation_id=operation_id, nombre=f'Prueba idempotencia {operation_id}',
            )
            return categoria.id, _representar(categoria), 201

        def _estado_actual(objeto_id):
            return _representar(Categoria.objects.get(id=objeto_id))

        return ejecutar_con_idempotencia(
            operation_id=operation_id, usuario=self.usuario, recurso='categorias', accion='CREATE',
            ejecutar=_ejecutar, obtener_estado_actual=_estado_actual,
        )

    def test_repetir_operation_id_no_reaplica_efectos(self):
        from inventario.models import Categoria

        contador = {'veces': 0}
        operation_id = uuid.uuid4()

        datos1, status1 = self._crear_categoria(contador, operation_id)
        datos2, status2 = self._crear_categoria(contador, operation_id)

        self.assertEqual(contador['veces'], 1)  # el efecto solo corrió una vez
        self.assertEqual(datos1, datos2)
        self.assertEqual(status1, status2)
        self.assertEqual(OperacionSincronizacion.objects.filter(operation_id=operation_id).count(), 1)
        self.assertEqual(Categoria.objects.filter(operation_id=operation_id).count(), 1)

    def test_error_de_negocio_se_repite_sin_reintentar(self):
        operation_id = uuid.uuid4()

        def _ejecutar():
            raise ErrorNegocio(code='STOCK_INSUFICIENTE', message='No hay existencias.', status_code=409)

        def _reintentar():
            return ejecutar_con_idempotencia(
                operation_id=operation_id, usuario=self.usuario, recurso='prueba', accion='CREATE',
                ejecutar=_ejecutar, obtener_estado_actual=lambda objeto_id: {},
            )

        with self.assertRaises(ErrorNegocio) as primero:
            _reintentar()
        with self.assertRaises(ErrorNegocio) as segundo:
            _reintentar()

        self.assertEqual(primero.exception.code, 'STOCK_INSUFICIENTE')
        self.assertEqual(segundo.exception.code, 'STOCK_INSUFICIENTE')
        self.assertEqual(segundo.exception.status_code, 409)
        registro = OperacionSincronizacion.objects.get(operation_id=operation_id)
        self.assertEqual(registro.estado, OperacionSincronizacion.Estado.CONFLICTO)

    def test_dos_peticiones_simultaneas_con_el_mismo_operation_id(self):
        from inventario.models import Categoria

        operation_id = uuid.uuid4()
        contador = {'veces': 0}
        resultados = []
        barrera = threading.Barrier(2)

        def _tarea():
            barrera.wait()
            try:
                resultados.append(self._crear_categoria(contador, operation_id))
            finally:
                from django.db import connection
                connection.close()

        hilos = [threading.Thread(target=_tarea) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        # El contador en memoria puede llegar a 2 (el hilo que pierde la
        # carrera sí alcanza a ejecutar _ejecutar() antes de que su
        # transacción se revierta); lo que importa es el efecto persistido.
        self.assertEqual(OperacionSincronizacion.objects.filter(operation_id=operation_id).count(), 1)
        self.assertEqual(Categoria.objects.filter(operation_id=operation_id).count(), 1)
        self.assertEqual(len(resultados), 2)
        self.assertEqual(resultados[0], resultados[1])


class DispositivoAPITests(ConfiguracionAPITestCase):
    """HU-051 — GET, POST y PATCH /api/dispositivos/ (Contrato v2 §4.1). Solo ADMIN."""

    def test_admin_registra_lista_y_autoriza(self):
        r_post = self.c_admin.post('/api/dispositivos/', {
            'identificador': str(uuid.uuid4()), 'nombre': 'Tablet mostrador',
        }, format='json')
        self.assertEqual(r_post.status_code, 201)
        self.assertFalse(r_post.data['autorizado_offline'])
        self.assertEqual(r_post.data['registrado_por_id'], self.admin.id)

        r_list = self.c_admin.get('/api/dispositivos/')
        self.assertEqual(r_list.status_code, 200)
        self.assertEqual(len(r_list.data), 1)

        r_patch = self.c_admin.patch(
            f"/api/dispositivos/{r_post.data['id']}/", {'autorizado_offline': True}, format='json',
        )
        self.assertEqual(r_patch.status_code, 200)
        self.assertTrue(r_patch.data['autorizado_offline'])

    def test_autorizar_revoca_el_anterior(self):
        d1 = Dispositivo.objects.create(identificador=uuid.uuid4(), nombre='Caja 1', registrado_por=self.admin)
        d2 = Dispositivo.objects.create(identificador=uuid.uuid4(), nombre='Caja 2', registrado_por=self.admin)

        self.c_admin.patch(f'/api/dispositivos/{d1.id}/', {'autorizado_offline': True}, format='json')
        r2 = self.c_admin.patch(f'/api/dispositivos/{d2.id}/', {'autorizado_offline': True}, format='json')
        self.assertEqual(r2.status_code, 200)

        d1.refresh_from_db()
        d2.refresh_from_db()
        self.assertFalse(d1.autorizado_offline)
        self.assertTrue(d2.autorizado_offline)

    def test_desactivar_no_elimina(self):
        d1 = Dispositivo.objects.create(identificador=uuid.uuid4(), nombre='Caja 1', registrado_por=self.admin)
        response = self.c_admin.patch(f'/api/dispositivos/{d1.id}/', {'activo': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['activo'])
        self.assertTrue(Dispositivo.objects.filter(pk=d1.id).exists())

    def test_operador_no_puede_administrar_dispositivos(self):
        response = self.c_operador.get('/api/dispositivos/')
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/dispositivos/')
        self.assertEqual(response.status_code, 401)


class SincronizacionAPITestCase(TestCase):
    """Base común: ADMIN, OPERADOR y un Dispositivo autorizado (HU-032, Bloque 5a)."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())

        self.c_admin = APIClient()
        self._autenticar(self.c_admin, 'admin1')
        self.c_operador = APIClient()
        self._autenticar(self.c_operador, 'oper1')

        from inventario.models import Categoria, Producto
        self.categoria = Categoria.objects.create(nombre='Bebidas')
        self.producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=Decimal('3500.00'), unidad_medida='unidad',
            controla_stock=True, stock_actual=Decimal('10'),
        )

        self.dispositivo = Dispositivo.objects.create(
            identificador=uuid.uuid4(), nombre='Caja 1', registrado_por=self.admin,
            activo=True, autorizado_offline=True,
        )

    def _autenticar(self, client, username):
        response = client.post(
            '/api/auth/login/', {'username': username, 'password': PASSWORD}, format='json',
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access_token']}")

    def _op(self, resource, action, payload, operation_id=None, fecha_cliente=None):
        return {
            'operation_id': str(operation_id or uuid.uuid4()),
            'resource': resource,
            'action': action,
            'fecha_cliente': (fecha_cliente or timezone.now()).isoformat(),
            'payload': payload,
        }

    def _sync(self, client, operations, device_id=None):
        if device_id is None:
            device_id = str(self.dispositivo.identificador)
        kwargs = {'HTTP_X_DEVICE_ID': device_id} if device_id else {}
        return client.post('/api/sync/', {'operations': operations}, format='json', **kwargs)


class SincronizacionAPITests(SincronizacionAPITestCase):
    """HU-032 — POST /api/sync/ (Contrato v2 §13, D16..D21)."""

    def test_sesion_completa_offline_queda_aplicada_con_fecha_y_precio_del_dispositivo(self):
        from finanzas.models import MovimientoCaja
        from ventas.models import DetalleVenta, Mesa, Venta

        mesa = Mesa.objects.create(numero=1)
        fecha_apertura = timezone.now() - timedelta(hours=2)
        fecha_cierre = fecha_apertura + timedelta(minutes=10)
        venta_id = uuid.uuid4()
        detalle_id = uuid.uuid4()

        ops = [
            self._op('ventas', 'CREATE', {
                'id': str(venta_id), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(mesa.id),
            }, fecha_cliente=fecha_apertura),
            self._op('ventas.detalles', 'CREATE', {
                'id': str(detalle_id), 'venta_id': str(venta_id), 'producto_id': str(self.producto.id),
                'cantidad': 2, 'precio_unitario': '3000.00',
            }, fecha_cliente=fecha_apertura),
            self._op('ventas.cerrar', 'UPDATE', {
                'venta_id': str(venta_id), 'medio_pago': 'EFECTIVO',
            }, fecha_cliente=fecha_cierre),
        ]

        response = self._sync(self.c_operador, ops)
        self.assertEqual(response.status_code, 200)
        resultados = response.data['results']
        self.assertTrue(all(r['estado'] == 'APLICADA' for r in resultados), resultados)

        venta = Venta.objects.get(pk=venta_id)
        self.assertEqual(venta.estado, 'CERRADA')
        self.assertEqual(venta.fecha_apertura, fecha_apertura)
        self.assertEqual(venta.fecha_cierre, fecha_cierre)
        self.assertEqual(venta.total, Decimal('6000.00'))  # precio del dispositivo (3000), no el vigente (3500)

        detalle = DetalleVenta.objects.get(pk=detalle_id)
        self.assertEqual(detalle.precio_unitario, Decimal('3000.00'))

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('8'))

        movimiento = MovimientoCaja.objects.get(venta=venta)
        self.assertEqual(movimiento.fecha, fecha_cierre)
        self.assertEqual(movimiento.estado_pago, 'CONFIRMADO')

        self.dispositivo.refresh_from_db()
        self.assertIsNotNone(self.dispositivo.ultima_sincronizacion)

    def test_reenvio_del_mismo_lote_devuelve_duplicada(self):
        from ventas.models import Mesa, Venta

        mesa = Mesa.objects.create(numero=2)
        op = self._op('ventas', 'CREATE', {
            'id': str(uuid.uuid4()), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(mesa.id),
        })

        self._sync(self.c_operador, [op])
        response = self._sync(self.c_operador, [op])

        resultado = response.data['results'][0]
        self.assertEqual(resultado['estado'], 'DUPLICADA')
        self.assertEqual(resultado['estado_original'], 'APLICADA')
        self.assertEqual(Venta.objects.count(), 1)

    def test_dispositivo_no_autorizado_o_sin_encabezado_rechaza_el_lote_sin_registrar_nada(self):
        op = self._op('categorias', 'CREATE', {'id': str(uuid.uuid4()), 'nombre': 'Postres'})

        sin_encabezado = self._sync(self.c_operador, [op], device_id='')
        self.assertEqual(sin_encabezado.status_code, 403)
        self.assertEqual(sin_encabezado.data['code'], 'DISPOSITIVO_NO_AUTORIZADO')

        con_id_ajeno = self._sync(self.c_operador, [op], device_id=str(uuid.uuid4()))
        self.assertEqual(con_id_ajeno.status_code, 403)

        self.assertEqual(OperacionSincronizacion.objects.filter(operation_id=op['operation_id']).count(), 0)

    def test_stock_insuficiente_al_cerrar_queda_en_conflicto_y_aparece_en_novedades(self):
        from ventas.models import Mesa, Venta

        mesa = Mesa.objects.create(numero=3)
        venta_id = uuid.uuid4()
        ops = [
            self._op('ventas', 'CREATE', {'id': str(venta_id), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(mesa.id)}),
            self._op('ventas.detalles', 'CREATE', {
                'id': str(uuid.uuid4()), 'venta_id': str(venta_id),
                'producto_id': str(self.producto.id), 'cantidad': 100,
            }),
            self._op('ventas.cerrar', 'UPDATE', {'venta_id': str(venta_id), 'medio_pago': 'EFECTIVO'}),
        ]

        response = self._sync(self.c_operador, ops)
        resultados = response.data['results']
        self.assertEqual(resultados[0]['estado'], 'APLICADA')
        self.assertEqual(resultados[1]['estado'], 'APLICADA')
        self.assertEqual(resultados[2]['estado'], 'CONFLICTO')
        self.assertEqual(resultados[2]['codigo_conflicto'], 'STOCK_INSUFICIENTE')

        venta = Venta.objects.get(pk=venta_id)
        self.assertEqual(venta.estado, 'ABIERTA')
        # D24: por sync el detalle se acepta aunque supere el stock; el conflicto es del cierre.
        self.assertEqual(venta.detalles.count(), 1)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('10'))

        novedades = self.c_admin.get('/api/sync/novedades/?atendida=false')
        self.assertEqual(novedades.status_code, 200)
        self.assertTrue(any(n['operation_id'] == resultados[2]['operation_id'] for n in novedades.data))

    def test_apertura_en_mesa_ocupada_genera_operacion_previa_fallida_en_dependientes(self):
        from ventas.models import Mesa, Venta

        mesa = Mesa.objects.create(numero=4)
        Venta.objects.create(
            tipo=Venta.Tipo.SESION_DINAMICA, usuario=self.admin, mesa=mesa, estado=Venta.Estado.ABIERTA,
        )
        mesa.estado = Mesa.Estado.OCUPADA
        mesa.save(update_fields=['estado'])

        venta_id = uuid.uuid4()
        ops = [
            self._op('ventas', 'CREATE', {'id': str(venta_id), 'tipo': 'SESION_DINAMICA', 'mesa_id': str(mesa.id)}),
            self._op('ventas.detalles', 'CREATE', {
                'id': str(uuid.uuid4()), 'venta_id': str(venta_id),
                'producto_id': str(self.producto.id), 'cantidad': 1,
            }),
            self._op('ventas.cerrar', 'UPDATE', {'venta_id': str(venta_id), 'medio_pago': 'EFECTIVO'}),
        ]

        response = self._sync(self.c_operador, ops)
        resultados = response.data['results']
        self.assertEqual(resultados[0]['estado'], 'CONFLICTO')
        self.assertEqual(resultados[0]['codigo_conflicto'], 'MESA_OCUPADA')
        self.assertEqual(resultados[1]['estado'], 'CONFLICTO')
        self.assertEqual(resultados[1]['codigo_conflicto'], 'OPERACION_PREVIA_FALLIDA')
        self.assertEqual(resultados[2]['estado'], 'CONFLICTO')
        self.assertEqual(resultados[2]['codigo_conflicto'], 'OPERACION_PREVIA_FALLIDA')

    def test_confirmar_pago_y_cierre_de_caja_requieren_conexion(self):
        ops = [
            self._op('movimientos-caja.confirmar', 'UPDATE', {'id': str(uuid.uuid4())}),
            self._op('cierres-caja', 'CREATE', {'fecha': '2026-09-20', 'efectivo_contado': '0.00'}),
        ]
        response = self._sync(self.c_admin, ops)
        resultados = response.data['results']
        self.assertEqual(resultados[0]['estado'], 'RECHAZADA')
        self.assertEqual(resultados[0]['codigo_conflicto'], 'PAGO_NO_VERIFICABLE')
        self.assertEqual(resultados[1]['estado'], 'RECHAZADA')
        self.assertEqual(resultados[1]['codigo_conflicto'], 'DATOS_INVALIDOS')

    def test_venta_sincronizada_con_fecha_de_periodo_ya_cerrado_entra_al_siguiente_cierre(self):
        from finanzas.models import MovimientoCaja

        primer_cierre = self.c_admin.post(
            '/api/cierres-caja/', {'fecha': '2026-01-01', 'efectivo_contado': '0.00'}, format='json',
        )
        self.assertEqual(primer_cierre.status_code, 201)

        fecha_vieja = timezone.now() - timedelta(days=5)
        venta_id = uuid.uuid4()
        op = self._op('ventas', 'CREATE', {
            'id': str(venta_id), 'tipo': 'RAPIDA', 'medio_pago': 'EFECTIVO',
            'detalles': [{'id': str(uuid.uuid4()), 'producto_id': str(self.producto.id), 'cantidad': 1}],
        }, fecha_cliente=fecha_vieja)

        response = self._sync(self.c_operador, [op])
        self.assertEqual(response.data['results'][0]['estado'], 'APLICADA')

        movimiento = MovimientoCaja.objects.get(venta_id=venta_id)
        self.assertEqual(movimiento.fecha, fecha_vieja)
        self.assertIsNone(movimiento.cierre_caja_id)

        segundo_cierre = self.c_admin.post('/api/cierres-caja/', {
            'fecha': '2026-01-02', 'efectivo_contado': str(self.producto.precio_venta),
        }, format='json')
        self.assertEqual(segundo_cierre.status_code, 201)

        movimiento.refresh_from_db()
        self.assertEqual(str(movimiento.cierre_caja_id), segundo_cierre.data['id'])

    def test_mesa_por_sincronizacion_exige_rol_admin(self):
        op = self._op('mesas', 'CREATE', {'id': str(uuid.uuid4()), 'numero': 9})
        response = self._sync(self.c_operador, [op])
        resultado = response.data['results'][0]
        self.assertEqual(resultado['estado'], 'RECHAZADA')
        self.assertEqual(resultado['codigo_conflicto'], 'PERMISO_INSUFICIENTE')

    def test_recurso_no_incluido_en_la_lista_cerrada_requiere_conexion(self):
        op = self._op('usuarios', 'CREATE', {'id': str(uuid.uuid4()), 'nombre_completo': 'Nuevo'})
        response = self._sync(self.c_admin, [op])
        resultado = response.data['results'][0]
        self.assertEqual(resultado['estado'], 'RECHAZADA')
        self.assertEqual(resultado['codigo_conflicto'], 'DATOS_INVALIDOS')

    def test_modulo_desactivado_rechaza_la_operacion_por_sincronizacion(self):
        config = ConfiguracionModulo.objects.obtener()
        config.inventario_activo = False
        config.save(update_fields=['inventario_activo'])

        op = self._op('inventario.movimientos', 'CREATE', {
            'id': str(uuid.uuid4()), 'tipo': 'ENTRADA', 'producto_id': str(self.producto.id), 'cantidad': 5,
        })
        response = self._sync(self.c_operador, [op])
        resultado = response.data['results'][0]
        self.assertEqual(resultado['estado'], 'RECHAZADA')
        self.assertEqual(resultado['codigo_conflicto'], 'MODULO_DESACTIVADO')

    def test_lote_supera_el_maximo_de_operaciones(self):
        operaciones = [
            self._op('categorias', 'CREATE', {'id': str(uuid.uuid4()), 'nombre': f'Cat {i}'})
            for i in range(201)
        ]
        response = self._sync(self.c_admin, operaciones)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')


class NovedadSincronizacionAPITests(SincronizacionAPITestCase):
    """HU-052 — GET y PATCH /api/sync/novedades/ (Contrato v2 §13)."""

    def _generar_novedad(self):
        op = self._op('movimientos-caja.confirmar', 'UPDATE', {'id': str(uuid.uuid4())})
        self._sync(self.c_operador, [op])
        return OperacionSincronizacion.objects.get(operation_id=op['operation_id'])

    def test_ambos_roles_pueden_listar_y_marcar_atendida(self):
        novedad = self._generar_novedad()

        r_list = self.c_operador.get('/api/sync/novedades/?atendida=false')
        self.assertEqual(r_list.status_code, 200)
        self.assertEqual(len(r_list.data), 1)

        r_patch = self.c_admin.patch(
            f'/api/sync/novedades/{novedad.id}/', {'atendida': True}, format='json',
        )
        self.assertEqual(r_patch.status_code, 200)
        self.assertTrue(r_patch.data['atendida'])

        r_list2 = self.c_operador.get('/api/sync/novedades/?atendida=false')
        self.assertEqual(len(r_list2.data), 0)

    def test_anonimo_recibe_401(self):
        response = APIClient().get('/api/sync/novedades/')
        self.assertEqual(response.status_code, 401)


class SincronizacionLote7Tests(SincronizacionAPITestCase):
    """Lote 7: cancelar orden (D29) e ingreso con costo (D31) por /api/sync/."""

    def test_cancelar_orden_por_sync(self):
        orden_id = str(uuid.uuid4())
        response = self._sync(self.c_admin, [
            self._op('ordenes-trabajo', 'CREATE', {
                'id': orden_id, 'cliente_nombre': 'Laura', 'descripcion': 'Torta',
                'fecha_entrega_estimada': '2026-10-20', 'costo_total': '50000.00',
            }),
            self._op('ordenes-trabajo.cancelar', 'UPDATE', {'orden_id': orden_id, 'motivo': 'Desistió'}),
            self._op('ordenes-trabajo.cancelar', 'UPDATE', {'orden_id': orden_id, 'motivo': 'Otra vez'}),
        ])

        estados = [r['estado'] for r in response.data['results']]
        self.assertEqual(estados, ['APLICADA', 'APLICADA', 'CONFLICTO'])
        self.assertEqual(response.data['results'][2]['codigo_conflicto'], 'ORDEN_CANCELADA')
        from servicios.models import OrdenTrabajo
        orden = OrdenTrabajo.objects.get(pk=orden_id)
        self.assertEqual(orden.estado, 'CANCELADA')
        self.assertEqual(orden.motivo_cancelacion, 'Desistió')

    def test_cancelar_orden_por_sync_operador_rechazada(self):
        from servicios.models import OrdenTrabajo
        orden = OrdenTrabajo.objects.create(
            usuario=self.admin, cliente_nombre='Laura', descripcion='Torta',
            fecha_entrega_estimada=timezone.localdate(), costo_total=Decimal('1000'),
            saldo_pendiente=Decimal('1000'), utilidad_neta=Decimal('1000'),
        )
        response = self._sync(self.c_operador, [
            self._op('ordenes-trabajo.cancelar', 'UPDATE', {'orden_id': str(orden.id), 'motivo': 'x'}),
        ])
        resultado = response.data['results'][0]
        self.assertEqual(resultado['estado'], 'RECHAZADA')
        self.assertEqual(resultado['codigo_conflicto'], 'PERMISO_INSUFICIENTE')

    def test_ingreso_con_costo_por_sync(self):
        from finanzas.models import MovimientoCaja
        from inventario.models import MovimientoInventario
        movimiento_id = str(uuid.uuid4())
        response = self._sync(self.c_operador, [
            self._op('inventario.movimientos', 'CREATE', {
                'id': movimiento_id, 'producto_id': str(self.producto.id), 'tipo': 'ENTRADA',
                'cantidad': '6', 'costo_total': '12000.00', 'medio_pago': 'EFECTIVO',
            }),
        ])

        self.assertEqual(response.data['results'][0]['estado'], 'APLICADA')
        movimiento = MovimientoInventario.objects.get(pk=movimiento_id)
        gasto = MovimientoCaja.objects.get(movimiento_inventario=movimiento)
        self.assertEqual(gasto.tipo, 'GASTO')
        self.assertEqual(gasto.valor, Decimal('12000.00'))
        self.assertEqual(gasto.estado_pago, 'CONFIRMADO')
        self.assertEqual(gasto.concepto, 'Compra: Cafe × 6')
        self.assertEqual(gasto.fecha, movimiento.fecha)
