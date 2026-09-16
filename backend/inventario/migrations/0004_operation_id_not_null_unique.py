import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0003_backfill_operation_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='categoria',
            name='operation_id',
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
        migrations.AlterField(
            model_name='producto',
            name='operation_id',
            field=models.UUIDField(default=uuid.uuid4, unique=True),
        ),
    ]
