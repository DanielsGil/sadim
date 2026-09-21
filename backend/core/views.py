from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ConfiguracionModulo, ConfiguracionPago, Dispositivo
from .permissions import EsAdmin, EsAdminUOperador
from .serializers import (
    ConfiguracionModuloSerializer,
    ConfiguracionPagoSerializer,
    DispositivoSerializer,
    EditarDispositivoSerializer,
)
from .services import actualizar_configuracion_modulos, editar_dispositivo


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
        instancia = actualizar_configuracion_modulos(usuario=request.user, datos=request.data)
        return Response(ConfiguracionModuloSerializer(instancia).data)


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


class DispositivoViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """/api/dispositivos/ — Contrato v2 §4.1 (HU-051). Todo el recurso es de ADMIN."""

    queryset = Dispositivo.objects.all().order_by('nombre')
    serializer_class = DispositivoSerializer
    permission_classes = [EsAdmin]

    def _obtener_dispositivo(self, pk):
        try:
            return Dispositivo.objects.get(pk=pk)
        except (Dispositivo.DoesNotExist, ValueError, TypeError):
            raise NotFound('El dispositivo no existe.')

    def partial_update(self, request, pk=None):
        dispositivo = self._obtener_dispositivo(pk)
        serializer = EditarDispositivoSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        dispositivo = editar_dispositivo(dispositivo=dispositivo, datos=serializer.validated_data)
        return Response(DispositivoSerializer(dispositivo).data)
