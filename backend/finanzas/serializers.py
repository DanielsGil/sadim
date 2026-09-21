from decimal import Decimal

from rest_framework import serializers

from .models import CierreCaja, MovimientoCaja


class MovimientoCajaSerializer(serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)
    venta_id = serializers.PrimaryKeyRelatedField(source='venta', read_only=True)
    abono_id = serializers.PrimaryKeyRelatedField(source='abono', read_only=True)
    cierre_caja_id = serializers.PrimaryKeyRelatedField(source='cierre_caja', read_only=True)

    class Meta:
        model = MovimientoCaja
        fields = [
            'id', 'operation_id', 'usuario_id', 'venta_id', 'abono_id', 'cierre_caja_id',
            'tipo', 'medio_pago', 'estado_pago', 'valor', 'concepto', 'fecha',
            'fecha_confirmacion', 'motivo_anulacion',
        ]
        read_only_fields = fields


class RegistrarGastoSerializer(serializers.Serializer):
    """POST /api/movimientos-caja/ (Contrato v2 §10, CU-14). Solo tipo GASTO."""

    operation_id = serializers.UUIDField(required=False)
    tipo = serializers.ChoiceField(choices=[(MovimientoCaja.Tipo.GASTO, MovimientoCaja.Tipo.GASTO)])
    medio_pago = serializers.ChoiceField(choices=MovimientoCaja.MedioPago.choices)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    concepto = serializers.CharField(max_length=255)


class ConfirmarMovimientoSerializer(serializers.Serializer):
    """PATCH /api/movimientos-caja/{id}/confirmar/ (Contrato v2 §10, P-02)."""

    operation_id = serializers.UUIDField(required=False)


class AnularMovimientoSerializer(serializers.Serializer):
    """PATCH /api/movimientos-caja/{id}/anular/ (D15)."""

    operation_id = serializers.UUIDField(required=False)
    motivo = serializers.CharField(max_length=255)


class ResumenQuerySerializer(serializers.Serializer):
    """GET /api/movimientos-caja/resumen/?fecha= (Contrato v2 §10, CU-20)."""

    fecha = serializers.DateField()


class CierreCajaSerializer(serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)

    class Meta:
        model = CierreCaja
        fields = [
            'id', 'operation_id', 'usuario_id', 'fecha', 'periodo_inicio', 'periodo_fin',
            'total_ingresos_ventas', 'total_ingresos_abonos', 'total_gastos', 'total_neto',
            'efectivo_esperado', 'efectivo_contado', 'diferencia', 'observaciones', 'fecha_creacion',
        ]
        read_only_fields = fields


class CrearCierreSerializer(serializers.Serializer):
    """POST /api/cierres-caja/ (Contrato v2 §11, CU-15)."""

    operation_id = serializers.UUIDField(required=False)
    fecha = serializers.DateField()
    efectivo_contado = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))
    observaciones = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
