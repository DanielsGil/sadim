from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import ErrorNegocio

from .models import Usuario

MENSAJE_CREDENCIALES_INVALIDAS = 'El usuario o la contraseña no son correctos.'


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Contrato API §3 (CU-17): login devuelve access_token, refresh_token, usuario_id y rol."""

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            # Usuario inexistente, contraseña incorrecta o activo = false
            # llegan aquí igual (simplejwt no distingue el caso); se unifica
            # en un único mensaje para no revelar cuál de los tres ocurrió.
            raise ErrorNegocio(
                code='CREDENCIALES_INVALIDAS',
                message=MENSAJE_CREDENCIALES_INVALIDAS,
                status_code=401,
            )

        return {
            'access_token': data['access'],
            'refresh_token': data['refresh'],
            'usuario_id': str(self.user.id),
            'rol': self.user.rol,
        }


class RegistroInicialSerializer(serializers.Serializer):
    """Contrato API §3: registro público del primer Administrador de la instalación."""

    nombre_completo = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        usuario_tentativo = Usuario(
            username=attrs['username'],
            nombre_completo=attrs['nombre_completo'],
        )
        try:
            validate_password(attrs['password'], user=usuario_tentativo)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs


class UsuarioSerializer(serializers.ModelSerializer):
    """Representación de Usuario (HU-044): nunca incluye password ni su hash."""

    class Meta:
        model = Usuario
        fields = ['id', 'nombre_completo', 'username', 'rol', 'activo', 'fecha_creacion']
        read_only_fields = fields


class UsuarioCrearSerializer(serializers.ModelSerializer):
    """
    POST /api/usuarios/ (Contrato v2 §4, P-06): crea siempre un OPERADOR.
    rol no es un campo de entrada: no se acepta ni se ignora, simplemente no
    existe en este serializer.
    """

    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = Usuario
        fields = ['id', 'nombre_completo', 'username', 'password', 'activo', 'fecha_creacion']
        read_only_fields = ['id', 'activo', 'fecha_creacion']

    def validate(self, attrs):
        usuario_tentativo = Usuario(username=attrs['username'], nombre_completo=attrs['nombre_completo'])
        try:
            validate_password(attrs['password'], user=usuario_tentativo)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return Usuario.objects.create_user(rol='OPERADOR', **validated_data)


class UsuarioActualizarSerializer(serializers.ModelSerializer):
    """
    PATCH /api/usuarios/{id}/ (Contrato v2 §4, P-06): solo nombre_completo,
    password (restablecimiento por el ADMIN) y activo. id, username, rol y
    fecha_creacion son de solo lectura y se ignoran si se envían.
    """

    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = Usuario
        fields = ['nombre_completo', 'password', 'activo']
        extra_kwargs = {'nombre_completo': {'required': False}, 'activo': {'required': False}}

    def validate_password(self, value):
        try:
            validate_password(value, user=self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class CustomTokenRefreshSerializer(serializers.Serializer):
    """D2: /api/auth/refresh/ recibe refresh_token y devuelve access_token."""

    refresh_token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh_token'])
        except TokenError:
            raise ErrorNegocio(
                code='NO_AUTENTICADO',
                message='El refresh token no es válido o expiró.',
                status_code=401,
            )
        return {'access_token': str(refresh.access_token)}
