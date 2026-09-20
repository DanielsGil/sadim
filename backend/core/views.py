from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ConfiguracionModulo, ConfiguracionPago
from .permissions import EsAdmin, EsAdminUOperador
from .serializers import ConfiguracionModuloSerializer, ConfiguracionPagoSerializer


class ConfiguracionPorRolMixin:
    """GET para ADMIN y OPERADOR; PATCH solo ADMIN (Contrato API v2 §12, §12.1)."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [EsAdminUOperador()]
        return [EsAdmin()]


class ConfiguracionModuloView(ConfiguracionPorRolMixin, APIView):
    """GET y PATCH /api/configuracion/modulos/ — HU-042, D-03."""

    def get(self, request):
        instancia = ConfiguracionModulo.objects.obtener()
        return Response(ConfiguracionModuloSerializer(instancia).data)

    def patch(self, request):
        instancia = ConfiguracionModulo.objects.obtener()
        serializer = ConfiguracionModuloSerializer(instancia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(actualizado_por=request.user, actualizado_en=timezone.now())
        return Response(serializer.data)


class ConfiguracionPagoView(ConfiguracionPorRolMixin, APIView):
    """GET y PATCH /api/configuracion/pagos/ — HU-049, D-06."""

    def get(self, request):
        instancia = ConfiguracionPago.objects.obtener()
        return Response(ConfiguracionPagoSerializer(instancia).data)

    def patch(self, request):
        instancia = ConfiguracionPago.objects.obtener()
        serializer = ConfiguracionPagoSerializer(instancia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(actualizado_por=request.user, actualizado_en=timezone.now())
        return Response(serializer.data)
