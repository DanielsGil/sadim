from rest_framework import serializers

from .models import ConfiguracionModulo, ConfiguracionPago


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
