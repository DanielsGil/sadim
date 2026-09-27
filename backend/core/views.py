from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
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


class HealthView(APIView):
    """GET /api/health/ — Bloque 6a (D25). Público y sin tocar la base de
    datos: sirve para despertar el plan Free de Render sin gastar horas ni
    conexiones de Neon."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'status': 'ok'})


def spa_view(request, *args, **kwargs):
    """Sirve index.html del build de la PWA — Bloque 6a (D25). Cualquier ruta
    que no sea /api/ ni /admin/ cae aquí (ver core/urls.py), para que rutas de
    cliente como /ventas sigan funcionando al recargar la página."""

    index_path = settings.FRONTEND_DIST / 'index.html'
    if not index_path.is_file():
        return HttpResponse(
            'El frontend no está construido (falta frontend/dist/index.html; '
            'corre `npm run build` en frontend/).',
            status=501,
        )
    return HttpResponse(index_path.read_text(encoding='utf-8'))


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
