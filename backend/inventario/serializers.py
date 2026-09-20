from rest_framework import serializers

from core.serializers import OperationIdInmutableMixin

from .models import Categoria, MovimientoInventario, Producto


class CategoriaSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class ProductoSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    # Contrato §6 / ERD §5.6: el campo se llama categoria_id en la solicitud
    # y la respuesta. El modelo y la columna de BD siguen llamándose
    # "categoria" (Django ya la mapea a la columna física "categoria_id");
    # esto solo cambia el nombre expuesto por la API.
    categoria_id = serializers.PrimaryKeyRelatedField(
        source='categoria', queryset=Categoria.objects.all(),
    )

    class Meta:
        model = Producto
        fields = [
            'id', 'operation_id', 'categoria_id', 'nombre', 'tipo',
            'precio_venta', 'costo_produccion', 'stock_actual', 'stock_minimo',
            'controla_stock', 'unidad_medida', 'activo',
        ]
        read_only_fields = ['stock_actual']

    def to_representation(self, instance):
        # D5: el OPERADOR no recibe costo_produccion (ADR-005).
        data = super().to_representation(instance)
        request = self.context.get('request')
        usuario = getattr(request, 'user', None)
        if getattr(usuario, 'rol', None) != 'ADMIN':
            data.pop('costo_produccion', None)
        return data


class MovimientoInventarioSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    """
    Contrato API v2 §9 (HU-025, adelanto). Este bloque solo crea ENTRADA por
    este endpoint (MERMA/AJUSTE_MANUAL quedan para Sprint 4, HU-026); SALIDA_VENTA
    la genera internamente el cierre de una venta (inventario.services.crear_salida_venta).
    """

    producto_id = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all())
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)
    venta_id = serializers.PrimaryKeyRelatedField(source='venta', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'operation_id', 'producto_id', 'usuario_id', 'venta_id',
            'tipo', 'cantidad', 'sentido', 'fecha', 'motivo',
        ]
        read_only_fields = ['fecha']

    def validate_tipo(self, value):
        if value != MovimientoInventario.Tipo.ENTRADA:
            raise serializers.ValidationError(
                'Por ahora este endpoint solo acepta ENTRADA; MERMA y AJUSTE_MANUAL llegan en Sprint 4.'
            )
        return value

    def validate_sentido(self, value):
        if value is not None:
            raise serializers.ValidationError('sentido solo aplica a AJUSTE_MANUAL (Sprint 4).')
        return value
