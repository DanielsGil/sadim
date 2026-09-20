import threading
import uuid

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.views import APIView

from usuarios.models import Usuario

from .exceptions import ErrorNegocio
from .idempotencia import ejecutar_con_idempotencia
from .models import ConfiguracionModulo, ConfiguracionPago, OperacionSincronizacion
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
