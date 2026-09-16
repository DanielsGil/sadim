from rest_framework import serializers

from .models import Categoria, Producto


class OperationIdInmutableMixin:
    """
    D6: operation_id se acepta en POST (o lo genera el servidor si no llega,
    vía el default del modelo); en PATCH no puede modificarse. Un
    operation_id repetido responde 400 DATOS_INVALIDOS: lo garantiza el
    UniqueValidator que DRF agrega solo por declarar este campo con el mismo
    nombre que el UNIQUE del modelo (no rompe con un IntegrityError de BD).
    """

    operation_id = serializers.UUIDField(required=False)

    def validate_operation_id(self, value):
        if self.instance is not None:
            raise serializers.ValidationError('operation_id no se puede modificar.')
        return value


class CategoriaSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class ProductoSerializer(OperationIdInmutableMixin, serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = '__all__'
        read_only_fields = ['stock_actual']

    def to_representation(self, instance):
        # D5: el OPERADOR no recibe costo_produccion (ADR-005).
        data = super().to_representation(instance)
        request = self.context.get('request')
        usuario = getattr(request, 'user', None)
        if getattr(usuario, 'rol', None) != 'ADMIN':
            data.pop('costo_produccion', None)
        return data
