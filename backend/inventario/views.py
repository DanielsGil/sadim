from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Categoria, Producto
from .serializers import CategoriaSerializer, ProductoSerializer

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated]

class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()  # <--- Esta línea es la que falta y soluciona el error del Router
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # HU-012: Retorna únicamente los productos activos
        return Producto.objects.filter(activo=True)

    def destroy(self, request, *args, **kwargs):
        # HU-011: Borrado lógico en lugar de eliminación física
        producto = self.get_object()
        producto.activo = False
        producto.save()
        return Response(status=status.HTTP_204_NO_CONTENT)