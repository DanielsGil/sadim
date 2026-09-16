"""Permission classes por rol para el catálogo (ADR-005, IMP-03)."""

from rest_framework.permissions import BasePermission


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
