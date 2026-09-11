from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Ejecuta la validación estándar de usuario y contraseña
        data = super().validate(attrs)
        
        # Agrega los campos extra que exige nuestro Contrato API (Sección 3)
        data['usuario_id'] = str(self.user.id)
        data['rol'] = self.user.rol
        
        return data