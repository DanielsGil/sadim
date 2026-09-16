# Evidencia — Cierre de Sprint 2 (SADIM)

Generado el 16/09/2026 en la rama `cierre-sprint-2`, contra PostgreSQL 18 (`sadim_db` / `test_sadim_db`). Corresponde a HU-007..HU-012 e IMP-01..IMP-10 (`docs/INCONSISTENCIAS.md`, sección D).

## 1. Salida completa de las pruebas

Comando: `python backend/manage.py test usuarios inventario -v 2`

```
Creating test database for alias 'default' ('test_sadim_db')...
Found 29 test(s).
Operations to perform:
  Synchronize unmigrated apps: messages, rest_framework, rest_framework_simplejwt, staticfiles
  Apply all migrations: admin, auth, contenttypes, inventario, sessions, usuarios
Synchronizing apps without migrations:
  Creating tables...
    Running deferred SQL...
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying contenttypes.0002_remove_content_type_name... OK
  Applying auth.0001_initial... OK
  Applying auth.0002_alter_permission_name_max_length... OK
  Applying auth.0003_alter_user_email_max_length... OK
  Applying auth.0004_alter_user_username_opts... OK
  Applying auth.0005_alter_user_last_login_null... OK
  Applying auth.0006_require_contenttypes_0002... OK
  Applying auth.0007_alter_validators_add_error_messages... OK
  Applying auth.0008_alter_user_username_max_length... OK
  Applying auth.0009_alter_user_last_name_max_length... OK
  Applying auth.0010_alter_group_name_max_length... OK
  Applying auth.0011_update_proxy_permissions... OK
  Applying auth.0012_alter_user_first_name_max_length... OK
  Applying usuarios.0001_initial... OK
  Applying admin.0001_initial... OK
  Applying admin.0002_logentry_remove_auto_add... OK
  Applying admin.0003_logentry_add_action_flag_choices... OK
  Applying inventario.0001_initial... OK
  Applying inventario.0002_operation_id_nullable... OK
  Applying inventario.0003_backfill_operation_id... OK
  Applying inventario.0004_operation_id_not_null_unique... OK
  Applying inventario.0005_producto_constraints... OK
  Applying sessions.0001_initial... OK
  Applying usuarios.0002_usuario_rol_constraint... OK
test_login_devuelve_las_cuatro_claves (usuarios.tests.LoginRefreshTests.test_login_devuelve_las_cuatro_claves) ... ok
test_login_password_incorrecta (usuarios.tests.LoginRefreshTests.test_login_password_incorrecta) ... ok
test_login_usuario_inactivo_mismo_mensaje_generico (usuarios.tests.LoginRefreshTests.test_login_usuario_inactivo_mismo_mensaje_generico) ... ok
test_login_usuario_inexistente_mismo_mensaje_generico (usuarios.tests.LoginRefreshTests.test_login_usuario_inexistente_mismo_mensaje_generico) ... ok
test_refresh_invalido (usuarios.tests.LoginRefreshTests.test_refresh_invalido) ... ok
test_refresh_valido (usuarios.tests.LoginRefreshTests.test_refresh_valido) ... ok
test_registro_crea_primer_admin (usuarios.tests.RegistroInicialTests.test_registro_crea_primer_admin) ... ok
test_registro_rechaza_segundo_usuario (usuarios.tests.RegistroInicialTests.test_registro_rechaza_segundo_usuario) ... ok
test_registro_valida_password_debil (usuarios.tests.RegistroInicialTests.test_registro_valida_password_debil) ... ok
test_activo_false_sincroniza_is_active (usuarios.tests.UsuarioModeloTests.test_activo_false_sincroniza_is_active) ... ok
test_createsuperuser_asigna_rol_admin (usuarios.tests.UsuarioModeloTests.test_createsuperuser_asigna_rol_admin) ... ok
test_rol_invalido_rechazado_por_bd (usuarios.tests.UsuarioModeloTests.test_rol_invalido_rechazado_por_bd) ... ok
test_admin_crea_producto_y_stock_actual_enviado_se_ignora (inventario.tests.CatalogoTests.test_admin_crea_producto_y_stock_actual_enviado_se_ignora) ... ok
test_admin_crea_y_edita_categoria (inventario.tests.CatalogoTests.test_admin_crea_y_edita_categoria) ... ok
test_admin_ve_inactivos_operador_no (inventario.tests.CatalogoTests.test_admin_ve_inactivos_operador_no) ... ok
test_baja_logica_y_reactivacion_de_producto (inventario.tests.CatalogoTests.test_baja_logica_y_reactivacion_de_producto) ... ok
test_filtros_categoria_y_tipo (inventario.tests.CatalogoTests.test_filtros_categoria_y_tipo) ... ok
test_operador_no_recibe_costo_produccion (inventario.tests.CatalogoTests.test_operador_no_recibe_costo_produccion) ... ok
test_operation_id_duplicado_en_api_responde_400 (inventario.tests.CatalogoTests.test_operation_id_duplicado_en_api_responde_400) ... ok
test_operation_id_no_se_puede_modificar (inventario.tests.CatalogoTests.test_operation_id_no_se_puede_modificar) ... ok
test_operador_no_puede_crear_categoria (inventario.tests.RBACTests.test_operador_no_puede_crear_categoria) ... ok
test_operador_no_puede_crear_ni_editar_producto (inventario.tests.RBACTests.test_operador_no_puede_crear_ni_editar_producto) ... ok
test_operador_no_puede_editar_categoria (inventario.tests.RBACTests.test_operador_no_puede_editar_categoria) ... ok
test_put_y_delete_no_permitidos_en_categorias (inventario.tests.RBACTests.test_put_y_delete_no_permitidos_en_categorias) ... ok
test_put_y_delete_no_permitidos_en_productos (inventario.tests.RBACTests.test_put_y_delete_no_permitidos_en_productos) ... ok
test_sin_token_devuelve_401_en_categorias_y_productos (inventario.tests.RBACTests.test_sin_token_devuelve_401_en_categorias_y_productos) ... ok
test_operation_id_duplicado_rechazado (inventario.tests.RestriccionesBDTests.test_operation_id_duplicado_rechazado) ... ok
test_precio_venta_negativo_rechazado (inventario.tests.RestriccionesBDTests.test_precio_venta_negativo_rechazado) ... ok
test_producto_duplicado_en_misma_categoria_rechazado (inventario.tests.RestriccionesBDTests.test_producto_duplicado_en_misma_categoria_rechazado) ... ok

----------------------------------------------------------------------
Ran 29 tests in 180.525s

OK
Destroying test database for alias 'default' ('test_sadim_db')...
 OK
System check identified no issues (0 silenced).
```

Nota: los ~180s los explica casi por completo el hasher de contraseñas de Django (PBKDF2, ~600 000 iteraciones), invocado en cada login de cada prueba — es el costo esperado de un hash de contraseñas seguro, no una prueba lenta por diseño.

## 2. Ejemplos de solicitud y respuesta

Capturados con `rest_framework.test.APIClient` contra las vistas reales (no simulados), en una base de datos vacía.

### POST /api/auth/register/ → 201

Solicitud:
```json
{
  "nombre_completo": "Ana Torres",
  "username": "admin.aroma",
  "password": "CafeAroma2026!"
}
```

Respuesta (201):
```json
{
  "usuario_id": "8b6635c7-089f-45be-8404-7fcd87691e91",
  "rol": "ADMIN"
}
```

### POST /api/auth/login/ → 200

Solicitud:
```json
{
  "username": "admin.aroma",
  "password": "CafeAroma2026!"
}
```

Respuesta (200) — exactamente las 4 claves del Contrato §3:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario_id": "8b6635c7-089f-45be-8404-7fcd87691e91",
  "rol": "ADMIN"
}
```

### POST /api/auth/refresh/ → 200 (D2)

Solicitud:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Respuesta (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /api/productos/ como ADMIN → 201

Solicitud (con `Authorization: Bearer <access_token del ADMIN>`):
```json
{
  "categoria": "d0ceb8f7-b3fc-4ddb-8979-775cdadf6683",
  "nombre": "Cafe americano",
  "tipo": "REVENTA_DIRECTA",
  "precio_venta": "3500.00",
  "costo_produccion": "1200.00",
  "unidad_medida": "unidad",
  "stock_minimo": "5",
  "controla_stock": true
}
```

Respuesta (201) — `stock_actual` es `0.00` aunque no se envió, `operation_id` lo generó el servidor:
```json
{
  "id": "2b65996b-5424-4440-a617-471486729464",
  "operation_id": "ae6aa66f-75bc-4763-ae93-37fe09d8e98a",
  "nombre": "Cafe americano",
  "tipo": "REVENTA_DIRECTA",
  "precio_venta": "3500.00",
  "costo_produccion": "1200.00",
  "stock_actual": "0.00",
  "stock_minimo": "5.00",
  "controla_stock": true,
  "unidad_medida": "unidad",
  "activo": true,
  "categoria": "d0ceb8f7-b3fc-4ddb-8979-775cdadf6683"
}
```

### POST /api/productos/ como OPERADOR → 403 (D1, IMP-03)

Mismo cuerpo que el ejemplo anterior, con `Authorization: Bearer <access_token del OPERADOR>`.

Respuesta (403):
```json
{
  "code": "PERMISO_INSUFICIENTE",
  "message": "No tiene permisos suficientes para realizar esta operación.",
  "details": {}
}
```

### DELETE /api/productos/{id}/ como ADMIN → 405 (D3, IMP-04)

Respuesta (405):
```json
{
  "code": "METODO_NO_PERMITIDO",
  "message": "El método HTTP utilizado no está permitido para este recurso.",
  "details": {}
}
```
