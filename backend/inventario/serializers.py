from rest_framework import serializers

from .models import Categoria, Producto


class OperationIdInmutableMixin:
    """
    D6: operation_id se acepta en POST (o lo genera el servidor si no llega,
    vía CreacionIdempotenteMixin); en PATCH no puede modificarse.

    HU-045 (Contrato v2 §13.1) reemplaza el 400 DATOS_INVALIDOS provisional:
    un operation_id repetido ya no es un error de validación, así que
    CreacionIdempotenteMixin decide qué responder (el resultado original, en
    vez de rechazar la petición). Para eso hay que quitar el UniqueValidator:
    declararlo con validators=[] no basta, porque ModelSerializer se lo
    vuelve a agregar después por ser el nombre de un campo UNIQUE del modelo
    (comprobado en el shell); se quita a mano en __init__, ya con el field
    construido.
    """

    operation_id = serializers.UUIDField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['operation_id'].validators = []

    def validate_operation_id(self, value):
        if self.instance is not None:
            raise serializers.ValidationError('operation_id no se puede modificar.')
        return value


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
