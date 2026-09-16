from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    RegistroInicialSerializer,
)
from .services import registrar_administrador_inicial


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
