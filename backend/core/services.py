"""Capa de servicios de core: configuración de módulos y dispositivos (ADR-002)."""

from django.db import transaction
from django.utils import timezone

from .exceptions import ErrorNegocio
from .models import ConfiguracionModulo, Dispositivo


def actualizar_configuracion_modulos(*, usuario, datos):
    """
    HU-042 (Contrato v2 §12, D-03): PATCH /api/configuracion/modulos/. Se
    reutiliza tal cual desde la vista en línea y desde el despachador de
    /api/sync/ (configuracion.modulos UPDATE, D17) para no duplicar la
    auditoría de actualizado_por/actualizado_en.
    """
    from .serializers import ConfiguracionModuloSerializer

    instancia = ConfiguracionModulo.objects.obtener()
    serializer = ConfiguracionModuloSerializer(instancia, data=datos, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save(actualizado_por=usuario, actualizado_en=timezone.now())
    return instancia


# ---------------------------------------------------------------------------
# HU-051 — dispositivos
# ---------------------------------------------------------------------------

def registrar_dispositivo(*, usuario, identificador, nombre, es_caja=False):
    """Contrato v2 §4.1 (CU-21): POST /api/dispositivos/, solo ADMIN."""
    return Dispositivo.objects.create(
        identificador=identificador,
        nombre=nombre,
        es_caja=es_caja,
        registrado_por=usuario,
    )


def editar_dispositivo(*, dispositivo, datos):
    """
    Contrato v2 §4.1 (CU-21, D-04): PATCH /api/dispositivos/{id}/. Autorizar
    un dispositivo revoca, en la misma transacción, al que estuviera
    autorizado antes (el índice único parcial de Dispositivo lo garantiza a
    nivel de BD; aquí solo se libera el anterior antes de guardar el nuevo
    para no chocar con esa restricción). Los dispositivos se desactivan,
    nunca se eliminan (R-32).
    """
    nuevo_autorizado = datos.get('autorizado_offline')
    with transaction.atomic():
        if nuevo_autorizado is True and not dispositivo.autorizado_offline:
            Dispositivo.objects.select_for_update().filter(autorizado_offline=True).update(
                autorizado_offline=False,
            )
        for campo, valor in datos.items():
            setattr(dispositivo, campo, valor)
        dispositivo.save()
    return dispositivo


def resolver_dispositivo_de_sync(*, device_id_header):
    """
    D16 (Bloque 5a): valida X-Device-Id contra un Dispositivo activo y
    autorizado_offline=true. Si falta o no corresponde, 403
    DISPOSITIVO_NO_AUTORIZADO — el llamador (la vista de /api/sync/) no debe
    registrar ningún operation_id del lote en ese caso (si los registrara,
    reenviarlos tras autorizar el dispositivo saldría DUPLICADA y se
    perderían). Desviación intencional del texto de D-04, documentada en
    CLAUDE.md.
    """
    if not device_id_header:
        raise ErrorNegocio(
            code='DISPOSITIVO_NO_AUTORIZADO',
            message='Falta el encabezado X-Device-Id.',
            status_code=403,
        )
    try:
        dispositivo = Dispositivo.objects.get(
            identificador=device_id_header, activo=True, autorizado_offline=True,
        )
    except (Dispositivo.DoesNotExist, ValueError, TypeError):
        raise ErrorNegocio(
            code='DISPOSITIVO_NO_AUTORIZADO',
            message='El dispositivo no está autorizado para sincronizar sin conexión.',
            status_code=403,
        )
    return dispositivo
