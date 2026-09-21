"""Permission classes compartidas por rol y por módulo (ADR-005, ADR-006)."""

from rest_framework.permissions import BasePermission

from .exceptions import ErrorNegocio
from .models import ConfiguracionModulo


class EsAdminUOperador(BasePermission):
    """Cualquier usuario autenticado con rol ADMIN u OPERADOR."""

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and getattr(usuario, 'rol', None) in ('ADMIN', 'OPERADOR')
        )


class EsAdmin(BasePermission):
    """Solo usuarios autenticados con rol ADMIN."""

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and getattr(usuario, 'rol', None) == 'ADMIN'
        )


# Contrato v2 §12 (P-04): mapa de bandera por módulo. El catálogo y las rutas
# del núcleo (auth, usuarios, dispositivos, categorías, productos,
# configuración, sync) no dependen de ninguna bandera.
CAMPO_BANDERA_POR_MODULO = {
    'ventas': 'ventas_activo',
    'inventario': 'inventario_activo',
    'servicios': 'servicios_activo',
    'finanzas': 'finanzas_activo',
}


def verificar_modulo_activo(modulo):
    """
    HU-042: 403 MODULO_DESACTIVADO si el módulo dado está desactivado.
    Función simple (no permission class) para que el mismo chequeo lo pueda
    invocar tanto ModuloActivoPermission (rutas en línea) como el despachador
    de /api/sync/ (Bloque 5a, HU-032), que valida módulo por operación en vez
    de por endpoint.
    """
    if modulo is None:
        return
    campo = CAMPO_BANDERA_POR_MODULO[modulo]
    configuracion = ConfiguracionModulo.objects.obtener()
    if not getattr(configuracion, campo):
        raise ErrorNegocio(
            code='MODULO_DESACTIVADO',
            message=f'El módulo {modulo} está desactivado.',
            status_code=403,
        )


def verificar_rol_admin(usuario):
    """Igual que EsAdmin, pero como función para el despachador de /api/sync/,
    que valida rol por operación en vez de por permission class de DRF."""
    if getattr(usuario, 'rol', None) != 'ADMIN':
        raise ErrorNegocio(
            code='PERMISO_INSUFICIENTE',
            message='Solo un ADMIN puede realizar esta operación.',
            status_code=403,
        )


class ModuloActivoPermission(BasePermission):
    """
    HU-042: bloquea con 403 MODULO_DESACTIVADO las rutas de un módulo
    desactivado. Un ViewSet solo necesita declarar `modulo = "ventas"` (uno
    de los cuatro nombres de CAMPO_BANDERA_POR_MODULO); si no declara
    `modulo`, esta clase no bloquea nada (ruta del núcleo).
    """

    def has_permission(self, request, view):
        verificar_modulo_activo(getattr(view, 'modulo', None))
        return True
