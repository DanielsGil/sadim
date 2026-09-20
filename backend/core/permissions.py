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


class ModuloActivoPermission(BasePermission):
    """
    HU-042: bloquea con 403 MODULO_DESACTIVADO las rutas de un módulo
    desactivado. Un ViewSet solo necesita declarar `modulo = "ventas"` (uno
    de los cuatro nombres de CAMPO_BANDERA_POR_MODULO); si no declara
    `modulo`, esta clase no bloquea nada (ruta del núcleo).
    """

    def has_permission(self, request, view):
        modulo = getattr(view, 'modulo', None)
        if modulo is None:
            return True

        campo = CAMPO_BANDERA_POR_MODULO[modulo]
        configuracion = ConfiguracionModulo.objects.obtener()
        if not getattr(configuracion, campo):
            raise ErrorNegocio(
                code='MODULO_DESACTIVADO',
                message=f'El módulo {modulo} está desactivado.',
                status_code=403,
            )
        return True
