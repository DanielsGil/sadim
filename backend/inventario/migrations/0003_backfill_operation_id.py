import uuid

from django.db import migrations


def llenar_operation_id(apps, schema_editor):
    # Un UUID distinto por fila: un default de campo evaluado por Django en un
    # AddField solo se calcula una vez para todas las filas existentes, por lo
    # que aquí se asigna explícitamente fila por fila.
    Categoria = apps.get_model('inventario', 'Categoria')
    Producto = apps.get_model('inventario', 'Producto')

    for categoria in Categoria.objects.filter(operation_id__isnull=True):
        categoria.operation_id = uuid.uuid4()
        categoria.save(update_fields=['operation_id'])

    for producto in Producto.objects.filter(operation_id__isnull=True):
        producto.operation_id = uuid.uuid4()
        producto.save(update_fields=['operation_id'])


def revertir(apps, schema_editor):
    # No hay nada que revertir: los valores se vuelven NULL de nuevo al
    # retroceder 0002, no hace falta borrar operation_id explícitamente aquí.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0002_operation_id_nullable'),
    ]

    operations = [
        migrations.RunPython(llenar_operation_id, revertir),
    ]
