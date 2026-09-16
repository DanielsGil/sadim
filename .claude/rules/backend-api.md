---
paths:
  - "**/views.py"
  - "**/views/**/*.py"
  - "**/serializers.py"
  - "**/serializers/**/*.py"
  - "**/urls.py"
  - "**/permissions.py"
  - "**/services.py"
  - "**/services/**/*.py"
---

# Reglas para la API DRF

Fuente: `docs/referencia/05_Contrato_API_SADIM.md`.

- Rutas, métodos y roles EXACTAMENTE como el contrato. No inventes endpoints; si hace falta uno nuevo (p. ej. Mesas, INC-06), propónlo y espera aprobación.
- Autorización con permission classes de DRF (p. ej. `EsAdmin`, `EsAdminUOperador`) según la columna "Rol requerido". Ocultar botones en el frontend no es seguridad.
- Cada endpoint de un módulo verifica en backend que el módulo esté activo en `ConfiguracionModulo` (ADR-006). Módulo inactivo ⇒ rechazo con el formato de error del contrato.
- En serializers son `read_only`: `stock_actual`, `total`, `subtotal`, `saldo_pendiente`, totales de cierre. `INGRESO_VENTA` e `INGRESO_ABONO` nunca se crean por POST del cliente (solo `GASTO` en /api/movimientos-caja/).
- Endpoints que aceptan `operation_id`: si ya fue procesado, devuelve el resultado previo o `ALREADY_PROCESSED` sin repetir efectos.
- Efectos múltiples dentro de `transaction.atomic()`; usa `select_for_update()` al leer stock o saldos que vas a modificar (evita que dos operaciones simultáneas descuenten el mismo stock).
- Lógica de negocio en la capa de servicios; views y serializers solo validan forma y delegan.
- Errores: `{"code", "message", "details"}` con los códigos de §14 (400 regla de negocio, 401 sin autenticación, 403 rol, 404, 409 conflicto de estado o duplicidad).
- Login devuelve `access_token`, `refresh_token`, `usuario_id`, `rol`. `/api/auth/register/` solo crea el primer ADMIN si no existen usuarios. Credenciales inválidas ⇒ mensaje genérico (CU-17).
