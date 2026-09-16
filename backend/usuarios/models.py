import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Q
from django.utils import timezone

class UsuarioManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('El usuario debe tener un username')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('rol', 'ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        # Para evitar error si lo dejas en blanco en la consola
        extra_fields.setdefault('nombre_completo', 'Super Admin')
        return self.create_user(username, password, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
    ROLES = (
        ('ADMIN', 'Administrador'),
        ('OPERADOR', 'Operador'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_completo = models.CharField(max_length=150)
    username = models.CharField(max_length=50, unique=True)
    rol = models.CharField(max_length=10, choices=ROLES, default='OPERADOR')
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['nombre_completo']

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(rol__in=['ADMIN', 'OPERADOR']),
                name='usuario_rol_valido',
            ),
        ]

    def save(self, *args, **kwargs):
        # ERD §5.1: un usuario con activo = false no puede autenticarse.
        # is_active es lo que revisan authenticate() y las permission classes de DRF.
        self.is_active = self.activo
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username