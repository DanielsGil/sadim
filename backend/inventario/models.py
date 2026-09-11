import uuid
from django.db import models

class Categoria(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    TIPO_CHOICES = (
        ('INSUMO_PRODUCCION', 'Insumo de producción'),
        ('REVENTA_DIRECTA', 'Reventa directa'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name='productos')
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    costo_produccion = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unidad_medida = models.CharField(max_length=20)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre