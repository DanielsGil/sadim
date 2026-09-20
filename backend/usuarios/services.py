"""Capa de servicios de usuarios: reglas de negocio, no de forma (ADR-002)."""

from django.db import transaction
from django.utils import timezone

from core.exceptions import ErrorNegocio
from core.models import ConfiguracionModulo, ConfiguracionPago

from .models import Usuario


def registrar_administrador_inicial(*, nombre_completo, username, password):
    """
    Contrato API §3: /api/auth/register/ solo crea el ADMIN inicial cuando la
    instalación todavía no tiene ningún usuario. Los usuarios siguientes se
    crean con /api/usuarios/ (CU-18, HU-044).

    D9: en la misma transacción, crea las filas únicas ConfiguracionModulo y
    ConfiguracionPago con actualizado_por = este ADMIN. ConfiguracionPago
    nace solo con efectivo (acepta_transferencia = acepta_qr = false),
    porque true/true/true (los valores por defecto del ERD) violaría de
    inmediato su propio CHECK de nequi_llave.
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

    with transaction.atomic():
        administrador = Usuario.objects.create_user(
            username=username,
            password=password,
            nombre_completo=nombre_completo,
            rol='ADMIN',
        )
        ahora = timezone.now()
        ConfiguracionModulo.objects.create(actualizado_por=administrador, actualizado_en=ahora)
        ConfiguracionPago.objects.create(actualizado_por=administrador, actualizado_en=ahora)

    return administrador


def actualizar_usuario(*, usuario, datos):
    """
    PATCH /api/usuarios/{id}/ (Contrato v2 §4, P-06). R-04: siempre debe
    quedar al menos un ADMIN activo; como POST solo crea OPERADOR y rol no
    es editable, la instalación tiene un único ADMIN, así que esta regla en
    la práctica impide desactivarlo.
    """
    if datos.get('activo') is False and usuario.rol == 'ADMIN':
        queda_otro_admin_activo = (
            Usuario.objects.filter(rol='ADMIN', activo=True).exclude(pk=usuario.pk).exists()
        )
        if not queda_otro_admin_activo:
            raise ErrorNegocio(
                code='ULTIMO_ADMIN_ACTIVO',
                message='No se puede desactivar al único administrador activo de la instalación.',
                status_code=409,
            )

    password = datos.pop('password', None)
    for campo, valor in datos.items():
        setattr(usuario, campo, valor)
    if password:
        usuario.set_password(password)
    usuario.save()
    return usuario
