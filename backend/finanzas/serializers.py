from decimal import Decimal

from rest_framework import serializers

from .models import CierreCaja, MovimientoCaja


class MovimientoCajaSerializer(serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)
    venta_id = serializers.PrimaryKeyRelatedField(source='venta', read_only=True)
    abono_id = serializers.PrimaryKeyRelatedField(source='abono', read_only=True)
    cierre_caja_id = serializers.PrimaryKeyRelatedField(source='cierre_caja', read_only=True)
    # D31: la ENTRADA de mercancía cuya compra registra este GASTO (o null).
    movimiento_inventario_id = serializers.PrimaryKeyRelatedField(source='movimiento_inventario', read_only=True)

    class Meta:
        model = MovimientoCaja
        fields = [
            'id', 'operation_id', 'usuario_id', 'venta_id', 'abono_id', 'cierre_caja_id',
            'tipo', 'medio_pago', 'estado_pago', 'valor', 'concepto', 'fecha',
            'fecha_confirmacion', 'motivo_anulacion', 'movimiento_inventario_id',
        ]
        read_only_fields = fields


def _origen_de(movimiento):
    """
    E-21 (Lote 7, amplía la respuesta del Contrato v2 §10): de dónde viene un
    movimiento de caja, para distinguir pagos del mismo valor al confirmarlos
    o anularlos. Sin cambios en el modelo: todo sale de las FK existentes.
    """
    if movimiento.tipo == MovimientoCaja.Tipo.INGRESO_VENTA and movimiento.venta_id:
        venta = movimiento.venta
        cantidades = {}
        for detalle in venta.detalles.all():
            nombre = detalle.producto.nombre
            cantidades[nombre] = cantidades.get(nombre, Decimal('0')) + detalle.cantidad
        return {
            'tipo': 'VENTA',
            'venta_id': str(venta.pk),
            'venta_tipo': venta.tipo,
            'mesa_numero': venta.mesa.numero if venta.mesa_id else None,
            'descripcion': f'Mesa {venta.mesa.numero}' if venta.mesa_id else 'Venta rápida',
            'fecha': serializers.DateTimeField().to_representation(venta.fecha_cierre or venta.fecha_apertura),
            'cobrado_por': movimiento.usuario.nombre_completo,
            'productos': [{'nombre': nombre, 'cantidad': cantidad} for nombre, cantidad in cantidades.items()],
        }
    if movimiento.tipo == MovimientoCaja.Tipo.INGRESO_ABONO and movimiento.abono_id:
        abono = movimiento.abono
        return {
            'tipo': 'ABONO',
            'abono_id': str(abono.pk),
            'orden_id': str(abono.orden_id),
            'cliente_nombre': abono.orden.cliente_nombre,
            'orden_descripcion': abono.orden.descripcion,
            'fecha': serializers.DateTimeField().to_representation(abono.fecha),
            'cobrado_por': movimiento.usuario.nombre_completo,
        }
    return {'tipo': 'GASTO', 'concepto': movimiento.concepto}


class MovimientoCajaConOrigenSerializer(MovimientoCajaSerializer):
    """E-21: pendientes e histórico del ADMIN agregan el objeto `origen`."""

    origen = serializers.SerializerMethodField()

    class Meta(MovimientoCajaSerializer.Meta):
        fields = MovimientoCajaSerializer.Meta.fields + ['origen']
        read_only_fields = fields

    def get_origen(self, obj):
        return _origen_de(obj)

    @staticmethod
    def preparar(queryset):
        """Evita una consulta por movimiento al armar `origen`."""
        return queryset.select_related('usuario', 'venta__mesa', 'abono__orden').prefetch_related(
            'venta__detalles__producto',
        )


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


class VistaPreviaCierreSerializer(serializers.Serializer):
    """GET /api/cierres-caja/vista-previa/ (D28, extiende el Contrato v2 §11). Montos como números JSON."""

    periodo_inicio = serializers.DateTimeField()
    periodo_fin = serializers.DateTimeField()
    total_ingresos_ventas = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_ingresos_abonos = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_gastos = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_neto = serializers.DecimalField(max_digits=12, decimal_places=2)
    efectivo_esperado = serializers.DecimalField(max_digits=12, decimal_places=2)
    por_medio_pago = serializers.DictField(child=serializers.DecimalField(max_digits=12, decimal_places=2))
    cantidad_movimientos = serializers.IntegerField()


class CrearCierreSerializer(serializers.Serializer):
    """POST /api/cierres-caja/ (Contrato v2 §11, CU-15)."""

    operation_id = serializers.UUIDField(required=False)
    fecha = serializers.DateField()
    efectivo_contado = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))
    observaciones = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
