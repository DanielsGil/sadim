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
    Contrato API v2 §9 (HU-025, HU-026). Este endpoint crea ENTRADA, MERMA y
    AJUSTE_MANUAL; SALIDA_VENTA y SALIDA_SERVICIO las genera el sistema
    internamente (cerrar una venta, entregar una orden), nunca el cliente.
    """

    producto_id = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all())
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)
    venta_id = serializers.PrimaryKeyRelatedField(source='venta', read_only=True)

    TIPOS_PERMITIDOS = (MovimientoInventario.Tipo.ENTRADA, MovimientoInventario.Tipo.MERMA, MovimientoInventario.Tipo.AJUSTE_MANUAL)

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'operation_id', 'producto_id', 'usuario_id', 'venta_id',
            'tipo', 'cantidad', 'sentido', 'fecha', 'motivo',
        ]
        read_only_fields = ['fecha']

    def validate_tipo(self, value):
        if value not in self.TIPOS_PERMITIDOS:
            raise serializers.ValidationError(
                f'Debe ser uno de: {", ".join(self.TIPOS_PERMITIDOS)}.'
            )
        return value

    def validate(self, attrs):
        tipo = attrs.get('tipo')
        motivo = attrs.get('motivo')
        sentido = attrs.get('sentido')

        if tipo in (MovimientoInventario.Tipo.MERMA, MovimientoInventario.Tipo.AJUSTE_MANUAL) and not motivo:
            raise serializers.ValidationError({'motivo': 'Es obligatorio para MERMA y AJUSTE_MANUAL.'})

        if tipo == MovimientoInventario.Tipo.AJUSTE_MANUAL and not sentido:
            raise serializers.ValidationError({'sentido': 'Es obligatorio para AJUSTE_MANUAL.'})
        if tipo != MovimientoInventario.Tipo.AJUSTE_MANUAL and sentido:
            raise serializers.ValidationError({'sentido': 'Solo aplica a AJUSTE_MANUAL.'})

        return attrs


class StockProductoSerializer(serializers.ModelSerializer):
    """
    GET /api/inventario/stock/ (Contrato v2 §9, HU-024). Los productos con
    controla_stock = false no llevan existencias propias: salen sin stock ni
    alerta (R-18). El Contrato no da un ejemplo de esta respuesta; esta forma
    reutiliza los mismos nombres de Producto.
    """

    categoria_id = serializers.PrimaryKeyRelatedField(source='categoria', read_only=True)
    alerta_stock_minimo = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id', 'categoria_id', 'nombre', 'tipo', 'unidad_medida',
            'controla_stock', 'stock_actual', 'stock_minimo', 'alerta_stock_minimo',
        ]
        read_only_fields = fields

    def get_alerta_stock_minimo(self, obj):
        if not obj.controla_stock:
            return False
        return obj.stock_actual <= obj.stock_minimo

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.controla_stock:
            data['stock_actual'] = None
            data['stock_minimo'] = None
        return data
