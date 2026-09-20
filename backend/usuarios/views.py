from rest_framework import mixins, viewsets
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import EsAdmin

from .models import Usuario
from .serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    RegistroInicialSerializer,
    UsuarioActualizarSerializer,
    UsuarioCrearSerializer,
    UsuarioSerializer,
)
from .services import actualizar_usuario, registrar_administrador_inicial


class CustomTokenObtainPairView(TokenObtainPairView):
    # Usamos nuestro serializador personalizado en lugar del que viene por defecto (CU-17).
    serializer_class = CustomTokenObtainPairSerializer


class RegistroInicialView(APIView):
    """POST /api/auth/register/ — Contrato API §3: solo crea el primer ADMIN."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistroInicialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = registrar_administrador_inicial(**serializer.validated_data)
        return Response({'usuario_id': str(usuario.id), 'rol': usuario.rol}, status=201)


class CustomTokenRefreshView(APIView):
    """POST /api/auth/refresh/ — D2: público, exige refresh_token, devuelve access_token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CustomTokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=200)


class UsuarioViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/usuarios/ — Contrato API v2 §4, P-06, HU-044. Todo el recurso es
    exclusivo de ADMIN, incluida la lectura (a diferencia del catálogo).
    """

    queryset = Usuario.objects.all()
    permission_classes = [EsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCrearSerializer
        if self.action in ('update', 'partial_update'):
            return UsuarioActualizarSerializer
        return UsuarioSerializer

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            raise MethodNotAllowed(request.method)

        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        usuario = actualizar_usuario(usuario=instance, datos=dict(serializer.validated_data))
        return Response(UsuarioSerializer(usuario).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        datos = UsuarioSerializer(usuario).data
        return Response(datos, status=201, headers=self.get_success_headers(datos))
