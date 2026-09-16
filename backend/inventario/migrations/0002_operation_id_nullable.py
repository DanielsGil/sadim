from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='categoria',
            name='operation_id',
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='producto',
            name='operation_id',
            field=models.UUIDField(null=True, blank=True),
        ),
    ]
