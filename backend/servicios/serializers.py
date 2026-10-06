from decimal import Decimal

from rest_framework import serializers

from inventario.models import Producto

from .models import Abono, ConsumoOrden, CostoOperativoOrden, OrdenTrabajo


class AbonoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Abono
        fields = ['id', 'operation_id', 'valor', 'medio_pago', 'estado_pago', 'fecha', 'observacion']
        read_only_fields = fields


class ConsumoOrdenSerializer(serializers.ModelSerializer):
    producto_id = serializers.PrimaryKeyRelatedField(source='producto', read_only=True)

    class Meta:
        model = ConsumoOrden
        fields = ['id', 'operation_id', 'producto_id', 'cantidad', 'estado', 'fecha_registro']
        read_only_fields = fields


class CostoOperativoOrdenSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostoOperativoOrden
        fields = ['id', 'operation_id', 'concepto', 'valor']
        read_only_fields = fields


class OrdenTrabajoSerializer(serializers.ModelSerializer):
    """
    Contrato v2 §8. Representación base de OrdenTrabajo (lista, respuesta de
    crear y de cambiar estado). utilidad_neta nunca se incluye en respuestas
    al OPERADOR (D5, CU-10) — requiere `request` en el contexto del serializer.
    """

    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)
    cancelada_por_id = serializers.PrimaryKeyRelatedField(source='cancelada_por', read_only=True)

    class Meta:
        model = OrdenTrabajo
        fields = [
            'id', 'operation_id', 'usuario_id', 'cliente_nombre', 'cliente_telefono',
            'descripcion', 'fecha_solicitud', 'fecha_entrega_estimada', 'estado',
            'costo_total', 'saldo_pendiente', 'utilidad_neta',
            # D29: campos de cancelación (null mientras la orden no esté CANCELADA).
            'motivo_cancelacion', 'cancelada_por_id', 'fecha_cancelacion',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        usuario = getattr(request, 'user', None)
        if getattr(usuario, 'rol', None) != 'ADMIN':
            data.pop('utilidad_neta', None)
        return data


class OrdenTrabajoDetalleSerializer(OrdenTrabajoSerializer):
    """D13: GET /api/ordenes-trabajo/{id}/ — agrega la lista de abonos."""

    abonos = AbonoSerializer(many=True, read_only=True)

    class Meta(OrdenTrabajoSerializer.Meta):
        fields = OrdenTrabajoSerializer.Meta.fields + ['abonos']
        read_only_fields = fields


class OrdenTrabajoCrearSerializer(serializers.Serializer):
    """POST /api/ordenes-trabajo/ (Contrato v2 §8, CU-06)."""

    operation_id = serializers.UUIDField(required=False)
    cliente_nombre = serializers.CharField(max_length=150)
    cliente_telefono = serializers.CharField(
        max_length=20, required=False, allow_null=True, allow_blank=True, default=None,
    )
    descripcion = serializers.CharField()
    fecha_entrega_estimada = serializers.DateField()
    costo_total = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))


class CambiarEstadoSerializer(serializers.Serializer):
    """PATCH /api/ordenes-trabajo/{id}/estado/ (Contrato v2 §8, CU-07)."""

    operation_id = serializers.UUIDField(required=False)
    estado = serializers.ChoiceField(choices=OrdenTrabajo.Estado.choices)


class CancelarOrdenSerializer(serializers.Serializer):
    """PATCH /api/ordenes-trabajo/{id}/cancelar/ (D29, solo ADMIN)."""

    operation_id = serializers.UUIDField(required=False)
    motivo = serializers.CharField(max_length=255)


class RegistrarAbonoSerializer(serializers.Serializer):
    """POST /api/ordenes-trabajo/{id}/abonos/ (Contrato v2 §8, CU-08)."""

    operation_id = serializers.UUIDField(required=False)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    medio_pago = serializers.ChoiceField(choices=Abono.MedioPago.choices)
    observacion = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)


class RegistrarConsumoSerializer(serializers.Serializer):
    """POST /api/ordenes-trabajo/{id}/consumos/ (Contrato v2 §8, CU-09)."""

    operation_id = serializers.UUIDField(required=False)
    producto_id = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))


class RegistrarCostoSerializer(serializers.Serializer):
    """POST /api/ordenes-trabajo/{id}/costos/ (Contrato v2 §8, CU-10)."""

    operation_id = serializers.UUIDField(required=False)
    concepto = serializers.CharField(max_length=150)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
