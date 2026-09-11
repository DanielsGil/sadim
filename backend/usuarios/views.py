from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    # Usamos nuestro serializador personalizado en lugar del que viene por defecto
    serializer_class = CustomTokenObtainPairSerializer