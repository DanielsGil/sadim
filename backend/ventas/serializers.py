from decimal import Decimal

from rest_framework import serializers

from core.serializers import OperationIdInmutableMixin
from inventario.models import Producto

from .models import DetalleVenta, Mesa, Venta
from .services import crear_mesa


class MesaSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    """Contrato v2 §7.1 (HU-043). estado es derivado: el cliente no lo escribe."""

    class Meta:
        model = Mesa
        fields = ['id', 'operation_id', 'numero', 'activa', 'estado']
        read_only_fields = ['estado']

    def validate_numero(self, value):
        # Contrato v2 §7.1: PATCH solo acepta activa; numero no es editable.
        if self.instance is not None and value != self.instance.numero:
            raise serializers.ValidationError('numero no se puede modificar.')
        return value

    def create(self, validated_data):
        return crear_mesa(
            numero=validated_data['numero'],
            operation_id=validated_data['operation_id'],
            id=validated_data.get('id'),
        )


class DetalleVentaSerializer(serializers.ModelSerializer):
    venta_id = serializers.PrimaryKeyRelatedField(source='venta', read_only=True)
    producto_id = serializers.PrimaryKeyRelatedField(source='producto', read_only=True)

    class Meta:
        model = DetalleVenta
        fields = ['id', 'operation_id', 'venta_id', 'producto_id', 'cantidad', 'precio_unitario', 'subtotal']
        read_only_fields = fields


class VentaSerializer(serializers.ModelSerializer):
    """Representación de Venta para GET, y para las respuestas de crear/cerrar/cancelar."""

    mesa_id = serializers.PrimaryKeyRelatedField(source='mesa', read_only=True)
    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = [
            'id', 'operation_id', 'tipo', 'estado', 'mesa_id',
            'fecha_apertura', 'fecha_cierre', 'medio_pago', 'estado_pago',
            'total', 'detalles',
        ]
        read_only_fields = fields


class DetalleVentaEntradaSerializer(serializers.Serializer):
    """Entrada de un producto dentro de la lista `detalles` de la venta rápida,
    o del cuerpo de POST /api/ventas/{id}/detalles/."""

    operation_id = serializers.UUIDField(required=False)
    producto_id = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))


class VentaCrearSerializer(serializers.Serializer):
    """POST /api/ventas/ (Contrato v2 §7, P-01): venta rápida o apertura de sesión."""

    operation_id = serializers.UUIDField(required=False)
    tipo = serializers.ChoiceField(choices=Venta.Tipo.choices)
    mesa_id = serializers.PrimaryKeyRelatedField(
        source='mesa', queryset=Mesa.objects.all(), required=False, allow_null=True,
    )
    medio_pago = serializers.ChoiceField(choices=Venta.MedioPago.choices, required=False, allow_null=True)
    detalles = DetalleVentaEntradaSerializer(many=True, required=False)

    def validate(self, attrs):
        tipo = attrs['tipo']
        if tipo == Venta.Tipo.RAPIDA:
            if attrs.get('mesa') is not None:
                raise serializers.ValidationError({'mesa_id': 'No aplica para una venta RAPIDA.'})
            if not attrs.get('medio_pago'):
                raise serializers.ValidationError({'medio_pago': 'Es obligatorio para una venta RAPIDA.'})
            if not attrs.get('detalles'):
                raise serializers.ValidationError({'detalles': 'Debe incluir al menos un producto.'})
        else:
            if attrs.get('mesa') is None:
                raise serializers.ValidationError({'mesa_id': 'Es obligatorio para una sesión dinámica.'})
            if attrs.get('medio_pago') or attrs.get('detalles'):
                raise serializers.ValidationError(
                    'Una sesión dinámica se abre sin detalles ni medio de pago.'
                )
        return attrs


class AgregarDetalleSerializer(serializers.Serializer):
    """POST /api/ventas/{id}/detalles/ (Contrato v2 §7, CU-03)."""

    operation_id = serializers.UUIDField(required=False)
    producto_id = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))


class CerrarVentaSerializer(serializers.Serializer):
    """PATCH /api/ventas/{id}/cerrar/ (Contrato v2 §7, CU-04)."""

    operation_id = serializers.UUIDField(required=False)
    medio_pago = serializers.ChoiceField(choices=Venta.MedioPago.choices)


class OperationIdOpcionalSerializer(serializers.Serializer):
    """Cuerpo de cancelar/eliminar: solo operation_id, opcional (D11)."""

    operation_id = serializers.UUIDField(required=False)
