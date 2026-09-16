from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Usuario
from .serializers import MENSAJE_CREDENCIALES_INVALIDAS

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    """Contrato API §14: toda respuesta de error es {code, message, details}."""
    test.assertIn('code', response.data)
    test.assertIn('message', response.data)
    test.assertIn('details', response.data)


class UsuarioModeloTests(TestCase):
    """ERD §5.1, HU-010: restricciones de BD sobre Usuario."""

    def test_rol_invalido_rechazado_por_bd(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                usuario = Usuario(username='malo', nombre_completo='Malo', rol='SUPERADMIN')
                usuario.set_password(PASSWORD)
                usuario.save()

    def test_activo_false_sincroniza_is_active(self):
        usuario = Usuario.objects.create_user(
            username='op1', password=PASSWORD, nombre_completo='Op Uno', rol='OPERADOR',
        )
        self.assertTrue(usuario.is_active)

        usuario.activo = False
        usuario.save()
        usuario.refresh_from_db()

        self.assertFalse(usuario.is_active)

    def test_createsuperuser_asigna_rol_admin(self):
        usuario = Usuario.objects.create_superuser(username='root', password=PASSWORD)

        self.assertEqual(usuario.rol, 'ADMIN')
        self.assertTrue(usuario.is_staff)
        self.assertTrue(usuario.is_superuser)


class RegistroInicialTests(TestCase):
    """POST /api/auth/register/ — Contrato API §3, HU-008, IMP-02."""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/auth/register/'

    def test_registro_crea_primer_admin(self):
        response = self.client.post(self.url, {
            'nombre_completo': 'Admin Uno',
            'username': 'admin1',
            'password': PASSWORD,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['rol'], 'ADMIN')
        self.assertIn('usuario_id', response.data)
        self.assertTrue(Usuario.objects.filter(username='admin1', rol='ADMIN').exists())

    def test_registro_rechaza_segundo_usuario(self):
        Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin', rol='ADMIN',
        )

        response = self.client.post(self.url, {
            'nombre_completo': 'Admin Dos',
            'username': 'admin2',
            'password': PASSWORD,
        }, format='json')

        self.assertEqual(response.status_code, 409)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'INSTALACION_YA_INICIALIZADA')
        self.assertFalse(Usuario.objects.filter(username='admin2').exists())

    def test_registro_valida_password_debil(self):
        response = self.client.post(self.url, {
            'nombre_completo': 'Admin Uno',
            'username': 'admin1',
            'password': '123',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')
        self.assertIn('password', response.data['details'])


class LoginRefreshTests(TestCase):
    """POST /api/auth/login/ y /api/auth/refresh/ — Contrato API §3, HU-008, IMP-01, D2."""

    def setUp(self):
        self.client = APIClient()
        self.usuario = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )

    def test_login_devuelve_las_cuatro_claves(self):
        response = self.client.post(
            '/api/auth/login/', {'username': 'oper1', 'password': PASSWORD}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data.keys()), {'access_token', 'refresh_token', 'usuario_id', 'rol'})
        self.assertEqual(response.data['usuario_id'], str(self.usuario.id))
        self.assertEqual(response.data['rol'], 'OPERADOR')

    def test_login_password_incorrecta(self):
        response = self.client.post(
            '/api/auth/login/', {'username': 'oper1', 'password': 'incorrecta'}, format='json',
        )

        self.assertEqual(response.status_code, 401)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'CREDENCIALES_INVALIDAS')
        self.assertEqual(response.data['message'], MENSAJE_CREDENCIALES_INVALIDAS)

    def test_login_usuario_inexistente_mismo_mensaje_generico(self):
        response = self.client.post(
            '/api/auth/login/', {'username': 'no-existe', 'password': 'x'}, format='json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'CREDENCIALES_INVALIDAS')
        self.assertEqual(response.data['message'], MENSAJE_CREDENCIALES_INVALIDAS)

    def test_login_usuario_inactivo_mismo_mensaje_generico(self):
        self.usuario.activo = False
        self.usuario.save()

        response = self.client.post(
            '/api/auth/login/', {'username': 'oper1', 'password': PASSWORD}, format='json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'CREDENCIALES_INVALIDAS')
        self.assertEqual(response.data['message'], MENSAJE_CREDENCIALES_INVALIDAS)

    def test_refresh_valido(self):
        login = self.client.post(
            '/api/auth/login/', {'username': 'oper1', 'password': PASSWORD}, format='json',
        )

        response = self.client.post(
            '/api/auth/refresh/', {'refresh_token': login.data['refresh_token']}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access_token', response.data)

    def test_refresh_invalido(self):
        response = self.client.post(
            '/api/auth/refresh/', {'refresh_token': 'basura'}, format='json',
        )

        self.assertEqual(response.status_code, 401)
        assert_error_shape(self, response)
        self.assertEqual(response.data['code'], 'NO_AUTENTICADO')
