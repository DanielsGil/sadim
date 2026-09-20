"""D9: para una instalación que ya tenga un ADMIN (creado antes de este
bloque, sin pasar por registrar_administrador_inicial), crea las filas
únicas ConfiguracionModulo y ConfiguracionPago si todavía no existen."""

from django.db import migrations
from django.utils import timezone


def crear_configuracion_si_falta(apps, schema_editor):
    Usuario = apps.get_model(*settings_auth_user_model())
    ConfiguracionModulo = apps.get_model('core', 'ConfiguracionModulo')
    ConfiguracionPago = apps.get_model('core', 'ConfiguracionPago')

    administrador = Usuario.objects.filter(rol='ADMIN').order_by('fecha_creacion').first()
    if administrador is None:
        return

    ahora = timezone.now()
    if not ConfiguracionModulo.objects.exists():
        ConfiguracionModulo.objects.create(
            pk='00000000-0000-0000-0000-000000000001',
            actualizado_por=administrador,
            actualizado_en=ahora,
        )
    if not ConfiguracionPago.objects.exists():
        ConfiguracionPago.objects.create(
            pk='00000000-0000-0000-0000-000000000002',
            actualizado_por=administrador,
            actualizado_en=ahora,
            acepta_transferencia=False,
            acepta_qr=False,
        )


def settings_auth_user_model():
    from django.conf import settings
    return settings.AUTH_USER_MODEL.split('.')


def revertir(apps, schema_editor):
    # No se revierte: no se sabe si la fila existía antes de esta migración.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('usuarios', '0003_alter_usuario_password'),
    ]

    operations = [
        migrations.RunPython(crear_configuracion_si_falta, revertir),
    ]
