import uuid
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import ConfiguracionPago
from finanzas.models import MovimientoCaja
from usuarios.models import Usuario
from ventas.models import Venta

from .models import Categoria, MovimientoInventario, Producto

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    """Contrato API §14: toda respuesta de error es EXACTAMENTE {code, message, details}."""
    test.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})


class RestriccionesBDTests(TestCase):
    """ERD §5.5, §5.6, HU-010: restricciones de BD sobre Categoria y Producto."""

    def setUp(self):
        self.categoria = Categoria.objects.create(nombre='Bebidas')

    def test_precio_venta_negativo_rechazado(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Producto.objects.create(
                    categoria=self.categoria, nombre='Malo', tipo='REVENTA_DIRECTA',
                    precio_venta=-1, unidad_medida='unidad',
                )

    def test_producto_duplicado_en_misma_categoria_rechazado(self):
        Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Producto.objects.create(
                    categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
                    precio_venta=4000, unidad_medida='unidad',
                )

    def test_operation_id_duplicado_rechazado(self):
        op_id = uuid.uuid4()
        Categoria.objects.create(nombre='Postres', operation_id=op_id)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Categoria.objects.create(nombre='Otra', operation_id=op_id)

    def test_costo_produccion_negativo_rechazado(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Producto.objects.create(
                    categoria=self.categoria, nombre='Malo', tipo='REVENTA_DIRECTA',
                    precio_venta=1000, costo_produccion=-1, unidad_medida='unidad',
                )

    def test_categoria_con_productos_no_se_puede_borrar(self):
        # D7: toda FK del dominio usa PROTECT (R-17, baja lógica del Contrato).
        Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )

        with self.assertRaises(ProtectedError):
            self.categoria.delete()

        self.assertTrue(Categoria.objects.filter(id=self.categoria.id).exists())


class CatalogoAPITestCase(TestCase):
    """Base común: usuarios ADMIN y OPERADOR autenticados, más una categoría."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        self.categoria = Categoria.objects.create(nombre='Bebidas')

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


class RBACTests(CatalogoAPITestCase):
    """HU-009, IMP-03: 401 sin token, 403 por rol, 405 en PUT/DELETE."""

    def test_sin_token_devuelve_401_en_categorias_y_productos(self):
        for metodo, url in [
            ('get', '/api/categorias/'),
            ('post', '/api/categorias/'),
            ('get', '/api/productos/'),
            ('post', '/api/productos/'),
        ]:
            response = getattr(self.c_anonimo, metodo)(url, {}, format='json')
            self.assertEqual(response.status_code, 401, f'{metodo} {url}')
            assert_error_shape(self, response)
            self.assertEqual(response.data['code'], 'NO_AUTENTICADO')

    def test_operador_no_puede_crear_categoria(self):
        response = self.c_operador.post('/api/categorias/', {'nombre': 'Postres'}, format='json')

        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_operador_no_puede_editar_categoria(self):
        response = self.c_operador.patch(
            f'/api/categorias/{self.categoria.id}/', {'nombre': 'Otra'}, format='json',
        )

        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_operador_no_puede_crear_ni_editar_producto(self):
        producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )

        r_post = self.c_operador.post('/api/productos/', {
            'categoria_id': self.categoria.id, 'nombre': 'Te', 'tipo': 'REVENTA_DIRECTA',
            'precio_venta': '2000.00', 'unidad_medida': 'unidad',
        }, format='json')
        self.assertEqual(r_post.status_code, 403)
        assert_error_shape(self, r_post)
        self.assertEqual(r_post.data['code'], 'PERMISO_INSUFICIENTE')

        r_patch = self.c_operador.patch(
            f'/api/productos/{producto.id}/', {'precio_venta': '4000.00'}, format='json',
        )
        self.assertEqual(r_patch.status_code, 403)
        assert_error_shape(self, r_patch)
        self.assertEqual(r_patch.data['code'], 'PERMISO_INSUFICIENTE')

    def test_producto_inexistente_responde_404(self):
        response = self.c_admin.get(f'/api/productos/{uuid.uuid4()}/')

        self.assertEqual(response.status_code, 404)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'RECURSO_NO_ENCONTRADO')

    def test_categoria_inexistente_responde_404(self):
        response = self.c_admin.patch(
            f'/api/categorias/{uuid.uuid4()}/', {'nombre': 'Otra'}, format='json',
        )

        self.assertEqual(response.status_code, 404)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'RECURSO_NO_ENCONTRADO')

    def test_put_y_delete_no_permitidos_en_categorias(self):
        r_put = self.c_admin.put(
            f'/api/categorias/{self.categoria.id}/', {'nombre': 'Otra'}, format='json',
        )
        r_delete = self.c_admin.delete(f'/api/categorias/{self.categoria.id}/')

        self.assertEqual(r_put.status_code, 405)
        assert_error_shape(self, r_put)
        self.assertEqual(r_put.data['code'], 'METODO_NO_PERMITIDO')
        self.assertEqual(r_delete.status_code, 405)
        assert_error_shape(self, r_delete)
        self.assertEqual(r_delete.data['code'], 'METODO_NO_PERMITIDO')

    def test_put_y_delete_no_permitidos_en_productos(self):
        producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )

        r_put = self.c_admin.put(f'/api/productos/{producto.id}/', {
            'categoria_id': self.categoria.id, 'nombre': 'Cafe', 'tipo': 'REVENTA_DIRECTA',
            'precio_venta': '4000.00', 'unidad_medida': 'unidad',
        }, format='json')
        r_delete = self.c_admin.delete(f'/api/productos/{producto.id}/')

        self.assertEqual(r_put.status_code, 405)
        assert_error_shape(self, r_put)
        self.assertEqual(r_put.data['code'], 'METODO_NO_PERMITIDO')
        self.assertEqual(r_delete.status_code, 405)
        assert_error_shape(self, r_delete)
        self.assertEqual(r_delete.data['code'], 'METODO_NO_PERMITIDO')


class CatalogoTests(CatalogoAPITestCase):
    """HU-011, HU-012, IMP-04, IMP-05, IMP-06, D4, D5, D6."""

    def test_admin_crea_y_edita_categoria(self):
        r_crea = self.c_admin.post('/api/categorias/', {'nombre': 'Postres'}, format='json')
        self.assertEqual(r_crea.status_code, 201)

        r_edita = self.c_admin.patch(
            f"/api/categorias/{r_crea.data['id']}/", {'nombre': 'Postres y panadería'}, format='json',
        )
        self.assertEqual(r_edita.status_code, 200)
        self.assertEqual(r_edita.data['nombre'], 'Postres y panadería')

    def test_admin_crea_producto_y_stock_actual_enviado_se_ignora(self):
        response = self.c_admin.post('/api/productos/', {
            'categoria_id': self.categoria.id, 'nombre': 'Cafe', 'tipo': 'REVENTA_DIRECTA',
            'precio_venta': '3500.00', 'costo_produccion': '1500.00',
            'unidad_medida': 'unidad', 'stock_actual': '999.00',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['categoria_id'], self.categoria.id)
        self.assertEqual(response.data['precio_venta'], Decimal('3500.00'))
        self.assertEqual(response.data['stock_actual'], Decimal('0.00'))

    def test_baja_logica_y_reactivacion_de_producto(self):
        producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )

        r_baja = self.c_admin.patch(f'/api/productos/{producto.id}/', {'activo': False}, format='json')
        self.assertEqual(r_baja.status_code, 200)
        self.assertFalse(r_baja.data['activo'])

        r_reactiva = self.c_admin.patch(f'/api/productos/{producto.id}/', {'activo': True}, format='json')
        self.assertEqual(r_reactiva.status_code, 200)
        self.assertTrue(r_reactiva.data['activo'])

    def test_admin_ve_inactivos_operador_no(self):
        activo = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )
        inactivo = Producto.objects.create(
            categoria=self.categoria, nombre='Te', tipo='REVENTA_DIRECTA',
            precio_venta=2000, unidad_medida='unidad', activo=False,
        )

        ids_admin = {p['id'] for p in self.c_admin.get('/api/productos/').data}
        ids_operador = {p['id'] for p in self.c_operador.get('/api/productos/').data}

        self.assertEqual(ids_admin, {str(activo.id), str(inactivo.id)})
        self.assertEqual(ids_operador, {str(activo.id)})

    def test_filtros_categoria_y_tipo(self):
        otra_categoria = Categoria.objects.create(nombre='Postres')
        Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
        )
        Producto.objects.create(
            categoria=otra_categoria, nombre='Torta', tipo='INSUMO_PRODUCCION',
            precio_venta=8000, unidad_medida='unidad',
        )

        r_categoria = self.c_admin.get(f'/api/productos/?categoria={self.categoria.id}')
        self.assertEqual(len(r_categoria.data), 1)
        self.assertEqual(r_categoria.data[0]['nombre'], 'Cafe')

        r_tipo = self.c_admin.get('/api/productos/?tipo=INSUMO_PRODUCCION')
        self.assertEqual(len(r_tipo.data), 1)
        self.assertEqual(r_tipo.data[0]['nombre'], 'Torta')

        r_categoria_invalida = self.c_admin.get('/api/productos/?categoria=no-es-uuid')
        self.assertEqual(r_categoria_invalida.status_code, 400)
        assert_error_shape(self, r_categoria_invalida)
        self.assertEqual(r_categoria_invalida.data['code'], 'DATOS_INVALIDOS')

        r_tipo_invalido = self.c_admin.get('/api/productos/?tipo=INVALIDO')
        self.assertEqual(r_tipo_invalido.status_code, 400)
        assert_error_shape(self, r_tipo_invalido)
        self.assertEqual(r_tipo_invalido.data['code'], 'DATOS_INVALIDOS')

    def test_operador_no_recibe_costo_produccion(self):
        Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, costo_produccion=1500, unidad_medida='unidad',
        )

        r_operador = self.c_operador.get('/api/productos/')
        r_admin = self.c_admin.get('/api/productos/')

        self.assertNotIn('costo_produccion', r_operador.data[0])
        self.assertEqual(r_admin.data[0]['costo_produccion'], Decimal('1500.00'))

    def test_operation_id_duplicado_repite_la_categoria_original(self):
        # HU-045 (Contrato v2 §13.1): reemplaza el 400 provisional de D6.
        # Repetir un operation_id ya procesado no crea nada nuevo; devuelve
        # el mismo código HTTP y el estado actual del objeto original.
        r1 = self.c_admin.post('/api/categorias/', {'nombre': 'Postres'}, format='json')
        op_id = r1.data['operation_id']

        r2 = self.c_admin.post(
            '/api/categorias/', {'nombre': 'Otra', 'operation_id': op_id}, format='json',
        )

        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.data, r1.data)
        self.assertEqual(Categoria.objects.filter(operation_id=op_id).count(), 1)
        self.assertFalse(Categoria.objects.filter(nombre='Otra').exists())

    def test_operation_id_no_se_puede_modificar(self):
        r1 = self.c_admin.post('/api/categorias/', {'nombre': 'Postres'}, format='json')

        r2 = self.c_admin.patch(
            f"/api/categorias/{r1.data['id']}/", {'operation_id': str(uuid.uuid4())}, format='json',
        )

        self.assertEqual(r2.status_code, 400)
        assert_error_shape(self, r2)
        self.assertEqual(r2.data['code'], 'DATOS_INVALIDOS')
        self.assertIn('operation_id', r2.data['details'])

    def test_operation_id_duplicado_en_producto_repite_el_original(self):
        r1 = self.c_admin.post('/api/productos/', {
            'categoria_id': self.categoria.id, 'nombre': 'Cafe', 'tipo': 'REVENTA_DIRECTA',
            'precio_venta': '3500.00', 'unidad_medida': 'unidad',
        }, format='json')
        op_id = r1.data['operation_id']

        r2 = self.c_admin.post('/api/productos/', {
            'operation_id': op_id, 'categoria_id': self.categoria.id, 'nombre': 'Otro',
            'tipo': 'REVENTA_DIRECTA', 'precio_venta': '1.00', 'unidad_medida': 'unidad',
        }, format='json')

        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.data['id'], r1.data['id'])
        self.assertEqual(r2.data['nombre'], 'Cafe')
        self.assertEqual(Producto.objects.filter(operation_id=op_id).count(), 1)

    def test_cambiar_controla_stock_con_existencias_responde_409(self):
        producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad', stock_actual=5,
        )

        response = self.c_admin.patch(
            f'/api/productos/{producto.id}/', {'controla_stock': False}, format='json',
        )

        self.assertEqual(response.status_code, 409)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PRODUCTO_CON_EXISTENCIAS')
        producto.refresh_from_db()
        self.assertTrue(producto.controla_stock)

    def test_cambiar_controla_stock_sin_existencias_permitido(self):
        producto = Producto.objects.create(
            categoria=self.categoria, nombre='Cafe', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad', stock_actual=0,
        )

        response = self.c_admin.patch(
            f'/api/productos/{producto.id}/', {'controla_stock': False}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['controla_stock'])


class MovimientoInventarioAPITests(CatalogoAPITestCase):
    """
    HU-025/HU-026 (Contrato v2 §9): POST/GET /api/inventario/movimientos/.
    ENTRADA es de ambos roles; MERMA y AJUSTE_MANUAL exigen ADMIN.
    """

    def setUp(self):
        super().setUp()
        self.producto = Producto.objects.create(
            categoria=self.categoria, nombre='Café', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad', stock_actual=5,
        )

    def _payload(self, **overrides):
        payload = {
            'operation_id': str(uuid.uuid4()), 'producto_id': str(self.producto.id),
            'tipo': 'ENTRADA', 'cantidad': 10, 'motivo': 'Compra de mercancía',
        }
        payload.update(overrides)
        return payload

    def test_operador_registra_entrada_y_suma_stock(self):
        response = self.c_operador.post('/api/inventario/movimientos/', self._payload(), format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['tipo'], 'ENTRADA')
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 15)

    def test_admin_registra_merma_y_resta_stock(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='MERMA', cantidad=2, motivo='Producto vencido',
        ), format='json')

        self.assertEqual(response.status_code, 201)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 3)

    def test_merma_mayor_al_stock_responde_409_y_no_cambia_stock(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='MERMA', cantidad=99, motivo='Producto vencido',
        ), format='json')

        self.assertEqual(response.status_code, 409)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 5)

    def test_operador_no_puede_registrar_merma(self):
        response = self.c_operador.post('/api/inventario/movimientos/', self._payload(
            tipo='MERMA', motivo='Producto vencido',
        ), format='json')

        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 5)

    def test_admin_registra_ajuste_manual_suma_y_resta(self):
        r_suma = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='AJUSTE_MANUAL', sentido='SUMA', cantidad=3, motivo='Conteo físico: sobraban 3',
        ), format='json')
        self.assertEqual(r_suma.status_code, 201)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 8)

        r_resta = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='AJUSTE_MANUAL', sentido='RESTA', cantidad=2, motivo='Conteo físico: faltaban 2',
        ), format='json')
        self.assertEqual(r_resta.status_code, 201)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 6)

    def test_ajuste_resta_mayor_al_stock_responde_409_y_no_cambia_stock(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='AJUSTE_MANUAL', sentido='RESTA', cantidad=99, motivo='Conteo físico',
        ), format='json')

        self.assertEqual(response.status_code, 409)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 5)

    def test_operador_no_puede_registrar_ajuste_manual(self):
        response = self.c_operador.post('/api/inventario/movimientos/', self._payload(
            tipo='AJUSTE_MANUAL', sentido='SUMA', motivo='Conteo físico',
        ), format='json')

        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'PERMISO_INSUFICIENTE')

    def test_ajuste_manual_sin_sentido_responde_400(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='AJUSTE_MANUAL', motivo='Conteo físico',
        ), format='json')

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_entrada_con_sentido_responde_400(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            sentido='SUMA',
        ), format='json')

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_merma_sin_motivo_responde_400(self):
        response = self.c_admin.post('/api/inventario/movimientos/', self._payload(
            tipo='MERMA', motivo='',
        ), format='json')

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/inventario/movimientos/')
        self.assertEqual(response.status_code, 401)

    def test_lista_filtrada_por_producto(self):
        self.c_admin.post('/api/inventario/movimientos/', self._payload(), format='json')
        otro_producto = Producto.objects.create(
            categoria=self.categoria, nombre='Agua', tipo='REVENTA_DIRECTA',
            precio_venta=2000, unidad_medida='unidad',
        )
        self.c_admin.post('/api/inventario/movimientos/', self._payload(
            operation_id=str(uuid.uuid4()), producto_id=str(otro_producto.id),
        ), format='json')

        response = self.c_admin.get(f'/api/inventario/movimientos/?producto={self.producto.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(str(response.data[0]['producto_id']), str(self.producto.id))

    def test_reintento_con_mismo_operation_id_no_duplica_entrada(self):
        payload = self._payload()
        primera = self.c_admin.post('/api/inventario/movimientos/', payload, format='json')
        segunda = self.c_admin.post('/api/inventario/movimientos/', payload, format='json')

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(primera.data['id'], segunda.data['id'])
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 15)  # no se sumó dos veces


class StockAPITests(CatalogoAPITestCase):
    """HU-024 (Contrato v2 §9): GET /api/inventario/stock/?categoria=&tipo=."""

    def setUp(self):
        super().setUp()
        self.bajo = Producto.objects.create(
            categoria=self.categoria, nombre='Café', tipo='REVENTA_DIRECTA',
            precio_venta=3500, unidad_medida='unidad',
            controla_stock=True, stock_actual=2, stock_minimo=5,
        )
        self.suficiente = Producto.objects.create(
            categoria=self.categoria, nombre='Agua', tipo='REVENTA_DIRECTA',
            precio_venta=2000, unidad_medida='unidad',
            controla_stock=True, stock_actual=20, stock_minimo=5,
        )
        self.sin_control = Producto.objects.create(
            categoria=self.categoria, nombre='Tinto preparado', tipo='INSUMO_PRODUCCION',
            precio_venta=1500, unidad_medida='unidad', controla_stock=False,
        )

    def _por_nombre(self, response, nombre):
        return next(item for item in response.data if item['nombre'] == nombre)

    def test_marca_alerta_en_o_bajo_stock_minimo(self):
        response = self.c_admin.get('/api/inventario/stock/')
        self.assertEqual(response.status_code, 200)

        self.assertTrue(self._por_nombre(response, 'Café')['alerta_stock_minimo'])
        self.assertFalse(self._por_nombre(response, 'Agua')['alerta_stock_minimo'])

    def test_producto_sin_control_de_stock_sale_sin_stock_ni_alerta(self):
        response = self.c_admin.get('/api/inventario/stock/')

        item = self._por_nombre(response, 'Tinto preparado')
        self.assertIsNone(item['stock_actual'])
        self.assertIsNone(item['stock_minimo'])
        self.assertFalse(item['alerta_stock_minimo'])

    def test_ambos_roles_pueden_consultar_stock(self):
        response = self.c_operador.get('/api/inventario/stock/')
        self.assertEqual(response.status_code, 200)

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.get('/api/inventario/stock/')
        self.assertEqual(response.status_code, 401)


class IngresoConCostoTests(CatalogoAPITestCase):
    """D31 (Lote 7, E-23): ENTRADA con costo_total y medio_pago crea un GASTO enlazado."""

    def setUp(self):
        super().setUp()
        ConfiguracionPago.objects.create(
            actualizado_por=self.admin, actualizado_en=timezone.now(),
            acepta_efectivo=True, acepta_transferencia=False, acepta_qr=True,
            nequi_titular='Aroma & Co.', nequi_llave='3001234567',
        )
        self.producto = Producto.objects.create(
            categoria=self.categoria, nombre='Leche', tipo='INSUMO_PRODUCCION',
            precio_venta=0, unidad_medida='litro', stock_actual=5,
        )

    def _post(self, **overrides):
        payload = {
            'operation_id': str(uuid.uuid4()), 'producto_id': str(self.producto.id),
            'tipo': 'ENTRADA', 'cantidad': '12', 'motivo': 'Proveedor Alquería',
        }
        payload.update(overrides)
        return self.c_operador.post('/api/inventario/movimientos/', payload, format='json')

    def test_ingreso_sin_costo_igual_que_antes(self):
        response = self._post()
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['gasto_id'])
        self.assertFalse(MovimientoCaja.objects.exists())
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 17)

    def test_ingreso_con_costo_crea_gasto_enlazado(self):
        response = self._post(costo_total='36000.00', medio_pago='QR')

        self.assertEqual(response.status_code, 201)
        gasto = MovimientoCaja.objects.get()
        self.assertEqual(str(gasto.pk), response.data['gasto_id'])
        self.assertEqual(str(gasto.movimiento_inventario_id), response.data['id'])
        self.assertEqual(gasto.tipo, 'GASTO')
        self.assertEqual(gasto.valor, Decimal('36000.00'))
        self.assertEqual(gasto.estado_pago, 'PENDIENTE_VERIFICACION')
        self.assertEqual(gasto.concepto, 'Compra: Leche × 12 — Proveedor Alquería')
        self.assertEqual(gasto.usuario, self.operador)

    def test_medio_no_habilitado_no_registra_nada(self):
        response = self._post(costo_total='36000.00', medio_pago='TRANSFERENCIA')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')
        self.assertFalse(MovimientoInventario.objects.exists())
        self.assertFalse(MovimientoCaja.objects.exists())
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 5)

    def test_costo_sin_medio_es_400(self):
        response = self._post(costo_total='36000.00')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})
        self.assertFalse(MovimientoInventario.objects.exists())

    def test_reintento_no_duplica_el_gasto(self):
        operation_id = str(uuid.uuid4())
        primera = self._post(operation_id=operation_id, costo_total='36000.00', medio_pago='EFECTIVO')
        segunda = self._post(operation_id=operation_id, costo_total='36000.00', medio_pago='EFECTIVO')

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(segunda.data['gasto_id'], primera.data['gasto_id'])
        self.assertEqual(MovimientoCaja.objects.count(), 1)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 17)

    def test_enlace_solo_permitido_en_gasto(self):
        movimiento = self._post().data['id']
        venta = Venta.objects.create(
            tipo='RAPIDA', usuario=self.admin, estado='CERRADA', medio_pago='EFECTIVO',
            estado_pago='CONFIRMADO', total=1000, fecha_cierre=timezone.now(),
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            MovimientoCaja.objects.create(
                usuario=self.admin, venta=venta, tipo='INGRESO_VENTA', medio_pago='EFECTIVO',
                valor=1000, fecha_confirmacion=timezone.now(), movimiento_inventario_id=movimiento,
            )
