import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Dispositivo(models.Model):
    """ERD §5.2 (D-04). Solo el modelo en este bloque; sus endpoints son HU-051 (Sprint 4)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identificador = models.UUIDField(unique=True)
    nombre = models.CharField(max_length=100, unique=True)
    es_caja = models.BooleanField(default=False)
    autorizado_offline = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)
    # D7: PROTECT en toda FK del dominio.
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='dispositivos_registrados',
    )
    fecha_registro = models.DateTimeField(default=timezone.now)
    ultima_sincronizacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['autorizado_offline'],
                condition=Q(autorizado_offline=True),
                name='dispositivo_unico_autorizado_offline',
            ),
        ]

    def __str__(self):
        return self.nombre


class ConfiguracionSingletonManager(models.Manager):
    """
    R-02: ConfiguracionModulo y ConfiguracionPago admiten exactamente una fila.
    El PK fijo de la subclase (SINGLETON_ID) garantiza que cualquier .save()
    actualice siempre la misma fila en vez de crear una nueva.
    """

    def obtener(self):
        instancia, _creada = self.get_or_create(pk=self.model.SINGLETON_ID)
        return instancia


class ConfiguracionModulo(models.Model):
    """ERD §5.3 (D-03). Fila única; ADR-006. HU-042."""

    SINGLETON_ID = uuid.UUID('00000000-0000-0000-0000-000000000001')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ventas_activo = models.BooleanField(default=True)
    inventario_activo = models.BooleanField(default=True)
    servicios_activo = models.BooleanField(default=True)
    finanzas_activo = models.BooleanField(default=True)
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name='+',
    )
    actualizado_en = models.DateTimeField(default=timezone.now)

    objects = ConfiguracionSingletonManager()

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_ID
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Configuración de módulos'


class ConfiguracionPago(models.Model):
    """
    ERD §5.4 (D-06). Fila única; HU-049.

    D9: nace solo con efectivo (acepta_transferencia = acepta_qr = false):
    los valores por defecto true/true/true del ERD violarían de inmediato el
    CHECK de nequi_llave de esta misma tabla.
    """

    SINGLETON_ID = uuid.UUID('00000000-0000-0000-0000-000000000002')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acepta_efectivo = models.BooleanField(default=True)
    acepta_transferencia = models.BooleanField(default=False)
    acepta_qr = models.BooleanField(default=False)
    nequi_titular = models.CharField(max_length=150, null=True, blank=True)
    nequi_llave = models.CharField(max_length=50, null=True, blank=True)
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+',
    )
    actualizado_en = models.DateTimeField(default=timezone.now)

    objects = ConfiguracionSingletonManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(acepta_transferencia=False, acepta_qr=False)
                    | Q(nequi_llave__isnull=False)
                ),
                name='configuracionpago_nequi_llave_si_electronico',
            ),
        ]

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_ID
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Configuración de pagos'


class OperacionSincronizacion(models.Model):
    """
    ERD §5.17 (D-05). Bitácora de idempotencia (HU-045, Contrato v2 §13.1).

    Desviaciones frente al ERD v3, aprobadas en este bloque porque el
    Contrato v2 §17 corrige al ERD (P-03) y no se edita el ERD directamente:
    - dispositivo_id admite NULL (antes NOT NULL) para operaciones en línea.
    - origen (EN_LINEA | SINCRONIZACION), atributo nuevo del Contrato v2 §17.
    - status_code_original: no está en el ERD; se necesita para poder repetir
      exactamente el mismo código HTTP en un reintento (Contrato v2 §13.1
      exige "el mismo código HTTP", y el ERD no tiene dónde guardarlo).
    """

    class Accion(models.TextChoices):
        CREATE = 'CREATE'
        UPDATE = 'UPDATE'
        DELETE = 'DELETE'

    class Estado(models.TextChoices):
        APLICADA = 'APLICADA'
        DUPLICADA = 'DUPLICADA'
        RECHAZADA = 'RECHAZADA'
        CONFLICTO = 'CONFLICTO'

    class Origen(models.TextChoices):
        EN_LINEA = 'EN_LINEA'
        SINCRONIZACION = 'SINCRONIZACION'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    operation_id = models.UUIDField(unique=True)
    dispositivo = models.ForeignKey(
        Dispositivo, on_delete=models.PROTECT, null=True, blank=True,
        related_name='operaciones_sincronizacion',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='operaciones_sincronizacion',
    )
    recurso = models.CharField(max_length=60)
    accion = models.CharField(max_length=10, choices=Accion.choices)
    estado = models.CharField(max_length=10, choices=Estado.choices)
    origen = models.CharField(max_length=20, choices=Origen.choices)
    codigo_conflicto = models.CharField(max_length=50, null=True, blank=True)
    mensaje = models.CharField(max_length=255, null=True, blank=True)
    objeto_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(null=True, blank=True)
    status_code_original = models.PositiveSmallIntegerField()
    fecha_cliente = models.DateTimeField()
    fecha_procesamiento = models.DateTimeField(default=timezone.now)
    atendida = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    ~Q(estado__in=['RECHAZADA', 'CONFLICTO']) | Q(codigo_conflicto__isnull=False)
                ),
                name='operacionsync_codigo_conflicto_si_rechazo',
            ),
            models.CheckConstraint(
                condition=~Q(estado='APLICADA') | Q(objeto_id__isnull=False),
                name='operacionsync_objeto_id_si_aplicada',
            ),
        ]
        indexes = [
            models.Index(fields=['estado', 'atendida']),
        ]

    def __str__(self):
        return f'{self.recurso} {self.operation_id} ({self.estado})'
