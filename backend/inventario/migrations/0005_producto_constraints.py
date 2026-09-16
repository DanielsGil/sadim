from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0004_operation_id_not_null_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='controla_stock',
            field=models.BooleanField(default=True),
        ),
        migrations.AddConstraint(
            model_name='producto',
            constraint=models.UniqueConstraint(
                fields=['categoria', 'nombre'],
                name='producto_categoria_nombre_unico',
            ),
        ),
        migrations.AddConstraint(
            model_name='producto',
            constraint=models.CheckConstraint(
                condition=Q(precio_venta__gte=0),
                name='producto_precio_venta_no_negativo',
            ),
        ),
        migrations.AddConstraint(
            model_name='producto',
            constraint=models.CheckConstraint(
                condition=Q(costo_produccion__isnull=True) | Q(costo_produccion__gte=0),
                name='producto_costo_produccion_no_negativo',
            ),
        ),
    ]
