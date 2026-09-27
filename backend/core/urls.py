"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from .sync import NovedadSincronizacionViewSet, SincronizacionView
from .views import (
    ConfiguracionModuloView,
    ConfiguracionPagoView,
    DispositivoViewSet,
    HealthView,
    spa_view,
)

router = DefaultRouter()
router.register(r'dispositivos', DispositivoViewSet, basename='dispositivo')
router.register(r'sync/novedades', NovedadSincronizacionViewSet, basename='novedad-sincronizacion')

urlpatterns = [
    path('admin/', admin.site.urls),
    # Bloque 6a (D25): público, sin base de datos.
    path('api/health/', HealthView.as_view(), name='health'),
    path('api/', include('usuarios.urls')),
    path('api/', include('inventario.urls')),
    path('api/', include('ventas.urls')),
    path('api/', include('servicios.urls')),
    path('api/', include('finanzas.urls')),
    path('api/', include(router.urls)),
    # HU-042 (D-03).
    path('api/configuracion/modulos/', ConfiguracionModuloView.as_view(), name='configuracion_modulos'),
    # HU-049 (D-06).
    path('api/configuracion/pagos/', ConfiguracionPagoView.as_view(), name='configuracion_pagos'),
    # HU-032 (Bloque 5a, Contrato v2 §13).
    path('api/sync/', SincronizacionView.as_view(), name='sync'),
    # Bloque 6a (D25): catch-all al final — cualquier ruta que no sea /api/ ni
    # /admin/ es del cliente (React Router) y debe recibir index.html.
    re_path(r'^(?!api/|admin/).*$', spa_view, name='spa'),
]
