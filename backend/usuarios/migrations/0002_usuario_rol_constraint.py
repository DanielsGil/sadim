from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0001_initial'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='usuario',
            constraint=models.CheckConstraint(
                condition=Q(rol__in=['ADMIN', 'OPERADOR']),
                name='usuario_rol_valido',
            ),
        ),
    ]
