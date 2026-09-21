from rest_framework import serializers

from .models import ConfiguracionModulo, ConfiguracionPago, Dispositivo


class OperationIdInmutableMixin:
    """
    D6: operation_id se acepta en la creación (o lo genera el servidor si no
    llega); en la edición no puede modificarse. Compartido por cualquier
    serializer cuyo modelo tenga un campo operation_id (Categoria, Producto,
    Mesa, Venta, DetalleVenta, MovimientoInventario...).

    HU-045 (Contrato v2 §13.1): un operation_id repetido no es un error de
    validación (lo decide core.idempotencia, que devuelve el resultado
    original), así que se le quita el UniqueValidator que ModelSerializer le
    agrega automáticamente por ser un campo UNIQUE del modelo.
    """

    operation_id = serializers.UUIDField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['operation_id'].validators = []

    def validate_operation_id(self, value):
        if self.instance is not None:
            raise serializers.ValidationError('operation_id no se puede modificar.')
        return value


class ConfiguracionModuloSerializer(serializers.ModelSerializer):
    """Contrato API v2 §12 (D-03, HU-042). Fila única."""

    actualizado_por_id = serializers.PrimaryKeyRelatedField(source='actualizado_por', read_only=True)

    class Meta:
        model = ConfiguracionModulo
        fields = [
            'ventas_activo', 'inventario_activo', 'servicios_activo', 'finanzas_activo',
            'actualizado_por_id', 'actualizado_en',
        ]
        read_only_fields = ['actualizado_en']


class ConfiguracionPagoSerializer(serializers.ModelSerializer):
    """Contrato API v2 §12.1 (D-06, HU-049). Fila única."""

    actualizado_por_id = serializers.PrimaryKeyRelatedField(source='actualizado_por', read_only=True)

    class Meta:
        model = ConfiguracionPago
        fields = [
            'acepta_efectivo', 'acepta_transferencia', 'acepta_qr',
            'nequi_titular', 'nequi_llave', 'actualizado_por_id', 'actualizado_en',
        ]
        read_only_fields = ['actualizado_en']

    def validate(self, attrs):
        # Contrato v2 §12.1: nequi_llave es obligatoria si TRANSFERENCIA o QR
        # están habilitados (CHECK de ConfiguracionPago, ERD §5.4).
        instancia = self.instance
        acepta_transferencia = attrs.get(
            'acepta_transferencia',
            instancia.acepta_transferencia if instancia else False,
        )
        acepta_qr = attrs.get('acepta_qr', instancia.acepta_qr if instancia else False)
        nequi_llave = attrs.get('nequi_llave', instancia.nequi_llave if instancia else None)

        if (acepta_transferencia or acepta_qr) and not nequi_llave:
            raise serializers.ValidationError({
                'nequi_llave': (
                    'Es obligatoria mientras acepta_transferencia o acepta_qr estén activos.'
                ),
            })
        return attrs


class DispositivoSerializer(serializers.ModelSerializer):
    """Contrato v2 §4.1 (HU-051). registrado_por_id es de auditoría, no editable."""

    registrado_por_id = serializers.PrimaryKeyRelatedField(source='registrado_por', read_only=True)

    class Meta:
        model = Dispositivo
        fields = [
            'id', 'identificador', 'nombre', 'es_caja', 'autorizado_offline', 'activo',
            'registrado_por_id', 'fecha_registro', 'ultima_sincronizacion',
        ]
        read_only_fields = ['fecha_registro', 'ultima_sincronizacion']

    def create(self, validated_data):
        from .services import registrar_dispositivo
        return registrar_dispositivo(
            usuario=self.context['request'].user,
            identificador=validated_data['identificador'],
            nombre=validated_data['nombre'],
            es_caja=validated_data.get('es_caja', False),
        )


class EditarDispositivoSerializer(serializers.Serializer):
    """PATCH /api/dispositivos/{id}/: marca es_caja, autoriza o desactiva (CU-21)."""

    es_caja = serializers.BooleanField(required=False)
    autorizado_offline = serializers.BooleanField(required=False)
    activo = serializers.BooleanField(required=False)
