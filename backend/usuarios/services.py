"""Capa de servicios de usuarios: reglas de negocio, no de forma (ADR-002)."""

from core.exceptions import ErrorNegocio

from .models import Usuario


def registrar_administrador_inicial(*, nombre_completo, username, password):
    """
    Contrato API §3: /api/auth/register/ solo crea el ADMIN inicial cuando la
    instalación todavía no tiene ningún usuario. Los usuarios siguientes se
    crean con /api/usuarios/ (CU-18, HU-044, Sprint 3).
    """
    if Usuario.objects.exists():
        raise ErrorNegocio(
            code='INSTALACION_YA_INICIALIZADA',
            message=(
                'La instalación ya tiene usuarios registrados; el registro '
                'público solo crea el primer administrador.'
            ),
            status_code=409,
        )

    return Usuario.objects.create_user(
        username=username,
        password=password,
        nombre_completo=nombre_completo,
        rol='ADMIN',
    )
