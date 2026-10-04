# 10 — Cambios posteriores al inventario (correcciones pre-documentación)

> Rama `correcciones-pre-documentacion`, creada desde `main` (`02ce97b`) el 03/10/2026. Doce commits, uno por ítem, **sin push ni merge**. Alcance cerrado: B1, B2, A1, A2, A3, A4, A6, A7, B5, B3, B4 y A5. No se modificaron `docs/referencia/` ni los archivos 00 a 09 de esta carpeta.
>
> **Ojo con el inventario 00–09:** se levantó el 02/10 sobre `8910c90`, antes de los lotes de corrección 4, 5 y 6 (E-10 a E-19), que ya estaban en `main` al empezar este trabajo. Por eso algunas rutas del inventario ya no existen: `paginas/CierreCaja.tsx` pasó a `componentes/PanelCierreCaja.tsx` (pestañas «Resumen del día» y «Cierre» dentro de Caja, E-18), e `IngresoMercancia` se integró en Inventario (E-13). A5 se aplicó sobre `PanelCierreCaja.tsx`. Además, D27 ya estaba ocupada (cierre de sesión por inactividad, E-11), así que la decisión nueva de A5 es **D28**.

---

## 1. Cambios por ítem

### B1 — `SECRET_KEY` obligatoria en producción (F-13)
- **Qué cambió:** en `backend/core/settings.py`, `DEBUG` se lee antes que `SECRET_KEY`. Si `DEBUG` es False y `SECRET_KEY` no está definida (o está vacía), se lanza `ImproperlyConfigured`: «SECRET_KEY no está definida. En producción (DEBUG=False) es obligatorio configurarla como variable de entorno.». Con `DEBUG=True` se mantiene el valor de desarrollo.
- **Verificado:**
  - `DEBUG=False` sin clave → `ImproperlyConfigured`.
  - `DEBUG=False` con clave → `check` sin problemas.
  - `collectstatic` con `SECRET_KEY` vacía y `DEBUG=True`, como en el build del `Dockerfile` (el `.env` no entra a la imagen, `.dockerignore`) → funciona.
  - 188 pruebas en verde.
- **Archivos:** `backend/core/settings.py`.
- **Pruebas agregadas:** ninguna (verificación por comandos).
- **Commit:** `e57e7a6`.

### B2 — El service worker no intercepta `/api/` ni `/admin/` (F-10)
- **Qué cambió:** `workbox.navigateFallbackDenylist = [/^\/api\//, /^\/admin\//]`.
- **Verificado en `dist/sw.js`:** `NavigationRoute(e.createHandlerBoundToURL("index.html"),{denylist:[/^\/api\//,/^\/admin\//]})`.
- **Archivos:** `frontend/vite.config.ts`.
- **Pruebas agregadas:** ninguna (verificación del build).
- **Commit:** `fc6c598`.

### A1 — Identidad de la PWA (F-16)
- **Logo:** no existía `logo-sadim.*`. Se creó `public/logo-sadim.svg`: monograma «S» blanco sobre un cuadrado redondeado del color de acento real `#aa3bff` (`--accent` de `index.css`). La «S» son dos arcos de circunferencia con extremos redondeados, sin fuentes de terceros. `favicon.svg` se reemplazó por el mismo logo (adiós al rayo de Vite).
- **PNG:** se generaron con Pillow 10.4.0 del Python del sistema, fuera del proyecto y sin tocar `requirements.txt` ni el `venv`. No había ImageMagick (el `convert` del PATH es el de Windows) ni Inkscape, y Pillow no renderiza SVG, así que la misma geometría se dibujó directamente con Pillow.
  - `icon-192.png` y `icon-512.png`: fondo redondeado con transparencia, `purpose: any`.
  - `icon-maskable-512.png`: fondo completo; la «S» queda dentro del 80 % central (zona segura).
  - `apple-touch-icon.png`: 180×180, fondo completo sin transparencia, porque iOS redondea solo.
- **Manifest:** `lang: 'es'`, `theme_color: '#aa3bff'` (antes `#863bff`), los tres PNG (el maskable aparte) más el SVG. El precache incluye `.png`.
- **`index.html`:**
  - `<html lang="es">` y `<title>SADIM</title>`;
  - `meta description` en español y `meta theme-color`;
  - `link rel="apple-touch-icon"` y `apple-mobile-web-app-title`.
- **Limpieza:** se borraron `src/assets/hero.png`, `react.svg` y `vite.svg` (ningún archivo los importaba). `frontend/README.md` se reemplazó por una descripción corta de SADIM que remite al README raíz.
- **Archivos:** `frontend/vite.config.ts`, `frontend/index.html`, `frontend/README.md`, `frontend/public/{favicon.svg, logo-sadim.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png}`, `frontend/src/assets/*` (borrados).
- **Pruebas agregadas:** ninguna (revisión visual de los PNG y del manifest generado).
- **Commit:** `1bf76fc`.

### A2 — Formato de moneda y fechas (F-17)
- **Qué cambió:** nuevo `frontend/src/utilidades/formato.ts`.
  - `formatoMoneda`: `es-CO`, COP, de 0 a 2 decimales. `12500` → «$ 12.500».
  - `formatoFechaHora`: `America/Bogota`, `medium`/`short`. → «21/09/2026, 10:15 a. m.».
  - `formatoFecha`: para fechas sin hora. Arma el día a mediodía UTC y lo formatea en UTC, así que nunca se corre al día anterior; no usa `new Date('AAAA-MM-DD')`.
  - `fechaHoyBogota`: `en-CA` con `America/Bogota`.
- **Dónde se aplicó (solo presentación; sin cambios en payloads, tipos de dominio ni campos de entrada):**
  - mapa de mesas;
  - tarjetas del selector de productos;
  - bandeja (precio por producto, barra compacta y «Total estimado», que antes usaba `toFixed(2)`);
  - detalle de mesa (precio unitario, subtotal, total);
  - listado de órdenes (entrega estimada, saldo);
  - detalle de orden (entrega estimada, costo total, saldo, abonos con su valor y fecha, utilidad neta, costos);
  - catálogo (precio de venta, costo de producción);
  - historial de inventario (fecha);
  - caja (pagos pendientes: valor y fecha);
  - resumen y cierre de caja;
  - novedades (fecha en el dispositivo);
  - dispositivos (última sincronización).
- **Archivos:** `utilidades/formato.ts` (nuevo), `paginas/{Caja, Catalogo, DetalleOrden, DetalleSesion, Dispositivos, Inventario, Novedades, Ordenes, Ventas}.tsx`, `componentes/{BandejaSeleccion, SelectorProductos, PanelCierreCaja}.tsx`.
- **Pruebas agregadas:** `utilidades/formato.test.ts` (7). Cubre moneda, texto no numérico, fecha y hora en Bogotá, una hora UTC que cambia de día, una fecha sin hora que no se corre (`2026-10-01` → `1/10/2026`) y `fechaHoyBogota` a las 21:00 de Bogotá (02:00 UTC del día siguiente).
- **Commit:** `b31ccc0`.

### A3 — Vocabulario del cobro de mesa (F-8)
- **Qué cambió:** los textos de la tabla del encargo en `DetalleSesion.tsx` (ver §2). «Cobrando…» usa un estado propio (`cobrando`), así que no aparece al quitar una línea. El «Cerrar sesión» del menú, que sale de la app, no cambió.
- **Archivos:** `frontend/src/paginas/DetalleSesion.tsx`.
- **Pruebas agregadas:** ninguna (solo textos).
- **Commit:** `d8bc4bb`.

### A4 — Mensajes del inicio de sesión (F-3)
- **Qué cambió:** el bloqueo de D21 ahora lanza una clase propia, `ErrorColaDeOtroUsuario` (`contexto/erroresSesion.ts`), con el mismo texto de antes. `Login.tsx` distingue por tipo, nunca comparando textos:
  1. `ErrorApi` → su `message`;
  2. `ErrorColaDeOtroUsuario` → el texto de D21;
  3. `!navigator.onLine` o `TypeError` (lo que lanza `fetch` sin red) → «No hay conexión. El primer inicio de sesión necesita internet.»;
  4. cualquier otro caso → «No se pudo iniciar sesión.».
- **Archivos:** `contexto/erroresSesion.ts` (nuevo), `contexto/SesionContext.tsx`, `paginas/Login.tsx`.
- **Pruebas agregadas:** ninguna (sin entorno DOM en Vitest; se verifica en la lista manual §5).
- **Commit:** `dca9f68`.

### A6 — Etiqueta de abono anulado (F-6)
- **Qué cambió:** `ETIQUETA_ESTADO_PAGO` pasa a `utilidades/etiquetas.ts`, tipada como `Record<EstadoPago, string>` con las tres etiquetas: «Confirmado», «Pendiente de verificación» y «Anulado». Así ningún estado puede quedar sin etiqueta. Revisión de las demás tablas: la única que muestra `estado_pago` es la de abonos de `DetalleOrden`; «Pagos pendientes» de Caja solo lista pendientes y no tiene esa columna.
- **Archivos:** `utilidades/etiquetas.ts` (nuevo), `paginas/DetalleOrden.tsx`.
- **Pruebas agregadas:** cubierto en `etiquetas.test.ts` (ver A7).
- **Commit:** `1cf8502`.

### A7 — Etiquetas legibles para códigos internos
- **Qué cambió:**
  - Historial de inventario, columna «Tipo»: `etiquetaMovimientoInventario`, con la tabla exacta del encargo.
  - Novedades, columna «Recurso»: `etiquetaRecursoSync`, con los 13 recursos D17 que encola el frontend; un recurso sin etiqueta se muestra tal cual.
  - La columna «Código» no cambió.
  - Todo está centralizado en `utilidades/etiquetas.ts`.
- **Archivos:** `utilidades/etiquetas.ts`, `paginas/Inventario.tsx`, `paginas/Novedades.tsx`.
- **Pruebas agregadas:** `utilidades/etiquetas.test.ts` (3): `ANULADO`, ajuste SUMA/RESTA y recurso desconocido.
- **Commit:** `e1f2ba3`.

### B5 — Estado real en las novedades locales (F-11)
- **Qué cambió:** `NovedadLocal` lleva `estado: 'RECHAZADA' | 'CONFLICTO'`, que el motor toma de la respuesta de `/api/sync/`. `almacenDexie` guarda ese estado en vez de fijar `'RECHAZADA'`. El armado de la fila se extrajo a `filaNovedadLocal()`, una función pura, para probarla sin IndexedDB.
- **Archivos:** `sync/motor.ts`, `sync/almacenDexie.ts`, `sync/motor.test.ts`.
- **Pruebas agregadas:** dos aserciones de estado en la prueba existente de depuración y una prueba nueva de `filaNovedadLocal` con CONFLICTO.
- **Commit:** `1984aec`.

### B3 — Precio del dispositivo en la sincronización (F-9, D19)
- **Forma que espera el backend** (`backend/core/sync.py`):
  - `ventas` CREATE RAPIDA → `payload.detalles[].precio_unitario` (líneas 190-192);
  - `ventas.detalles` CREATE → `payload.precio_unitario` (línea 220).
  - Ambos son opcionales y numéricos. Si no llegan, el servidor usa el precio vigente.
- **Qué cambió:** en `api/ventas.ts`, `crearVentaRapida` y `agregarDetalle` leen el `precio_venta` del producto en la copia local del catálogo al momento de agregarlo y lo ponen en el `payload` de `escribir()`. Ese `payload` solo se usa cuando la operación se **encola**; la llamada en línea arma su propio cuerpo y **no** lo envía. Si el producto no está en la copia local, se omite. Subtotal y total los sigue calculando el servidor.
- **CLAUDE.md:** D19 ahora describe el comportamiento del cliente. D22 ya decía que el dispositivo envía el `precio_unitario` mostrado; con B3 eso es cierto, así que su texto no se tocó.
- **Archivos:** `frontend/src/api/ventas.ts`, `CLAUDE.md`.
- **Pruebas agregadas:** `api/ventas.test.ts` (2), con dobles en memoria del enrutador, la copia local y el cliente HTTP.
  - El payload encolado de `ventas.detalles` lleva `precio_unitario: 7500` y el cuerpo en línea no.
  - En la venta rápida, cada detalle encolado lleva su precio, se omite si el producto no está en la copia local, y el cuerpo en línea no lo lleva.
- **Commit:** `20907da`.

### B4 — Mapa de mesas sin conexión (F-1)
- **Qué cambió:** `Ventas.tsx` usa el nuevo `api/mapaMesas.ts::obtenerMapaMesas()`, que aplica la misma regla del enrutador (`debeEscribirEnLinea`):
  - con conexión y cola vacía, consulta al servidor y guarda `meta.ventas_abiertas`;
  - sin conexión, con cola pendiente, o si la petición falla por red, arma el mapa con la copia local (`sync/vistaLocalMesas.ts`).
- **Cómo se arma la copia local:** mesas activas del almacén `catalogo`, más `meta.ventas_abiertas`, más las operaciones de ventas que **siguen en la cola**: abrir cuenta, agregar o quitar producto, cobrar, cancelar. Se filtran por la cola, igual que en `vistaLocalOrdenes`, porque `operaciones_locales` no se depura después de sincronizar. El precio de una línea sale del payload (B3) o, si no viene, de la copia del catálogo. Ya no falla por `listarVentas` sin `mesaId`.
- **En pantalla:** `AvisoCopiaLocal` sin conexión y «provisional» junto al total de cada mesa cuando el mapa viene de la copia local.
- **Archivos:** `api/mapaMesas.ts` (nuevo), `sync/vistaLocalMesas.ts` (nuevo), `paginas/Ventas.tsx`.
- **Pruebas agregadas:** `sync/vistaLocalMesas.test.ts` (3), con datos en memoria:
  - una cuenta abierta sin conexión ocupa la mesa con su total;
  - sobre la copia del servidor se aplica el precio del dispositivo, quitar una línea y cobrar otra mesa (que queda libre);
  - las mesas inactivas no se muestran y el total del servidor se conserva si nada cambió.
- **Commit:** `5f89fad`.

### A5 — Cierre de caja (F-4, F-5, CU-15) y endpoint nuevo (D28)
- **Backend:**
  - De `finanzas/services.py::crear_cierre` se extrajeron `_calcular_periodo_inicio`, `_movimientos_a_consolidar` (criterio D14, sin bloqueo) y `calcular_totales_cierre`, sin persistencia ni bloqueos.
  - `crear_cierre` las reutiliza; el `select_for_update()` lo agrega solo él. Su comportamiento no cambió: las 29 pruebas previas de `finanzas`, incluida la concurrencia de dos cierres, siguen en verde.
  - Nueva `calcular_vista_previa_cierre()`, nuevo `VistaPreviaCierreSerializer` y nueva acción `GET /api/cierres-caja/vista-previa/` en `CierreCajaViewSet`, que hereda `EsAdmin` y `ModuloActivoPermission` con `modulo='finanzas'`.
- **Frontend (`componentes/PanelCierreCaja.tsx`, pestañas «Resumen del día» y «Cierre» de Caja):**
  - fecha por defecto `fechaHoyBogota()` (F-5);
  - «Resumen del día» agrega Transferencia y QR;
  - nueva sección «Lo que se va a cerrar», con los datos de la vista previa;
  - «Diferencia estimada» = efectivo contado − `efectivo_esperado` de la vista previa. Solo se muestra; se eliminó el cálculo anterior, que no descontaba los gastos;
  - el mensaje «Cierre registrado. Diferencia final: …» queda visible hasta que se cambie la fecha o se registre otro cierre. La recarga posterior ya no lo borra (F-4);
  - nueva sección «Cierres anteriores» (`listarCierres`);
  - sin conexión, las secciones muestran «Requiere conexión.» y el botón «Requiere conexión», como antes.
  - El aviso de E-05 (cola pendiente) se mantiene.
- **Archivos:** `backend/finanzas/{services, serializers, views, tests}.py`, `frontend/src/api/cierres.ts`, `frontend/src/tipos/dominio.ts` (tipo nuevo `VistaPreviaCierre`), `frontend/src/componentes/PanelCierreCaja.tsx`, `frontend/src/App.css`, `CLAUDE.md` (D28 y D25).
- **Pruebas agregadas:** `finanzas.tests.VistaPreviaCierreTests` (6):
  - la vista previa coincide campo a campo con lo que guarda el cierre, no crea ningún `CierreCaja` y devuelve montos como números JSON;
  - OPERADOR → 403 `PERMISO_INSUFICIENTE`;
  - módulo desactivado → 403 `MODULO_DESACTIVADO`;
  - sin movimientos → ceros;
  - un pago `PENDIENTE_VERIFICACION` no aparece;
  - un gasto en efectivo reduce `efectivo_esperado` (y no `por_medio_pago`, que son ingresos).
- **Commit:** `3072214`.

---

## 2. Textos de interfaz (para el manual de usuario)

`{x}` = valor insertado. «—» en «Texto anterior» = el texto no existía.

| Pantalla | Texto anterior | Texto nuevo |
|---|---|---|
| Pestaña del navegador / PWA | «frontend» (`<title>`) | «SADIM» |
| Nombre en la pantalla de inicio (iOS) | — | «SADIM» (`apple-mobile-web-app-title`) |
| Descripción de la página | — | «SADIM: ventas, mesas, órdenes de trabajo, inventario y caja para micro-comercios, también sin conexión.» |
| Ícono de la app | Rayo de Vite (morado) | Monograma «S» blanco sobre fondo morado `#aa3bff` |
| Todas las pantallas con montos (A2) | Número crudo, p. ej. «12500» o «3500.5»; «Total estimado: 12500.00» | Moneda COP, p. ej. «$ 12.500», «$ 3.500,5»; «Total estimado: $ 12.500» |
| Todas las pantallas con fecha y hora (A2) | ISO crudo, p. ej. «2026-09-21T10:15:02-05:00» | «21/09/2026, 10:15 a. m.» (hora de Bogotá) |
| Órdenes / Detalle de orden: entrega estimada; Cierres anteriores: fecha (A2) | «2026-10-01» | «1/10/2026» |
| Inicio de sesión | «No se pudo iniciar sesión.» (sin conexión) | «No hay conexión. El primer inicio de sesión necesita internet.» |
| Inicio de sesión | «No se pudo iniciar sesión.» (otro usuario con operaciones pendientes) | «Hay operaciones sin sincronizar de otro usuario en este dispositivo. Inicia sesión con esa cuenta primero.» |
| Inicio de sesión | «No se pudo iniciar sesión.» (cualquier otro fallo) | «No se pudo iniciar sesión.» (sin cambio) |
| Ventas (mapa de mesas) | «No se pudo cargar el mapa de mesas.» (sin conexión) | El mapa se muestra desde la copia local con el aviso «Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.» |
| Ventas (mapa de mesas) | «Total: {total}» | «Total: {total}» + etiqueta «provisional» cuando viene de la copia local |
| Detalle de mesa | Título de respaldo «Sesión» | «Cuenta» |
| Detalle de mesa | «Cargando sesión…» | «Cargando cuenta…» |
| Detalle de mesa | «No se pudo cargar la sesión.» | «No se pudo cargar la cuenta.» |
| Detalle de mesa | «Todavía no se ha abierto nada. Agrega el primer producto para abrir la sesión.» | «Esta mesa no tiene una cuenta abierta. Agrega el primer producto para abrirla.» |
| Detalle de mesa | Sección «Cerrar sesión» | «Cobrar cuenta» |
| Detalle de mesa | Botón «Cerrar sesión» | «Cobrar y cerrar cuenta» (mientras envía: «Cobrando…») |
| Detalle de mesa | «Selecciona un medio de pago para cerrar.» | «Selecciona un medio de pago para cobrar.» |
| Detalle de mesa | «No se pudo cerrar la sesión.» | «No se pudo cobrar la cuenta.» |
| Detalle de mesa | Botón «Cancelar sesión» | «Cancelar cuenta» |
| Detalle de mesa | «¿Seguro que quieres cancelar esta sesión? No se generará ningún movimiento.» | «¿Seguro que quieres cancelar esta cuenta? No se cobrará nada ni se descontará inventario.» |
| Detalle de mesa | Botones «No» / «Sí, cancelar sesión» | «No» / «Sí, cancelar cuenta» |
| Detalle de mesa | «No se pudo cancelar la sesión.» | «No se pudo cancelar la cuenta.» |
| Detalle de mesa | «No se pudo abrir la sesión.» | «No se pudo abrir la cuenta.» |
| Detalle de mesa | «No se pudo actualizar la sesión.» | «No se pudo actualizar la cuenta.» |
| Detalle de orden, tabla «Abonos», columna «Estado» | (vacío para ANULADO) | «Anulado» |
| Inventario, historial, columna «Tipo» | «ENTRADA» | «Ingreso de mercancía» |
| Inventario, historial, columna «Tipo» | «SALIDA_VENTA» | «Salida por venta» |
| Inventario, historial, columna «Tipo» | «SALIDA_SERVICIO» | «Salida por orden de trabajo» |
| Inventario, historial, columna «Tipo» | «MERMA» | «Merma» |
| Inventario, historial, columna «Tipo» | «AJUSTE_MANUAL (SUMA)» | «Ajuste manual (suma)» |
| Inventario, historial, columna «Tipo» | «AJUSTE_MANUAL (RESTA)» | «Ajuste manual (resta)» |
| Novedades, columna «Recurso» | «ventas» | «Venta» |
| Novedades, columna «Recurso» | «ventas.detalles» | «Producto en cuenta de mesa» |
| Novedades, columna «Recurso» | «ventas.cerrar» | «Cobro de cuenta de mesa» |
| Novedades, columna «Recurso» | «ventas.cancelar» | «Cancelación de cuenta de mesa» |
| Novedades, columna «Recurso» | «mesas» | «Mesa» |
| Novedades, columna «Recurso» | «ordenes-trabajo» | «Orden de trabajo» |
| Novedades, columna «Recurso» | «ordenes-trabajo.estado» | «Cambio de estado de orden» |
| Novedades, columna «Recurso» | «ordenes-trabajo.abonos» | «Abono» |
| Novedades, columna «Recurso» | «ordenes-trabajo.consumos» | «Consumo de orden» |
| Novedades, columna «Recurso» | «ordenes-trabajo.costos» | «Costo operativo» |
| Novedades, columna «Recurso» | «inventario.movimientos» | «Movimiento de inventario» |
| Novedades, columna «Recurso» | «movimientos-caja» | «Gasto» |
| Novedades, columna «Recurso» | «configuracion.modulos» | «Configuración de módulos» |
| Caja → Resumen del día | — | «Transferencia (ingresos): {valor}» |
| Caja → Resumen del día | — | «QR (ingresos): {valor}» |
| Caja → Resumen del día / Cierre | «No se pudo cargar el resumen del día.» (en ambas pestañas) | Resumen: «No se pudo cargar el resumen del día.» (sin cambio); Cierre: «No se pudo cargar lo que se va a cerrar.» |
| Caja → Resumen del día / Cierre / Cierres anteriores | — (sin conexión salía el error de carga) | «Requiere conexión.» |
| Caja → Cierre | «Efectivo (ingresos) del día: {valor}» (lote 6) | Se elimina; lo reemplaza «Efectivo esperado: {valor}» de la sección nueva |
| Caja → Cierre | — | «Cargando lo que se va a cerrar…» |
| Caja → Cierre | — | Sección «Lo que se va a cerrar» |
| Caja → Cierre | — | «Período: desde {fecha y hora} hasta ahora» |
| Caja → Cierre | — | «Ingresos por ventas: {valor}», «Ingresos por abonos: {valor}», «Gastos: {valor}», «Neto: {valor}» |
| Caja → Cierre | — | «Efectivo esperado: {valor}» |
| Caja → Cierre | — | «El cierre incluye todos los movimientos confirmados que aún no se han cerrado, aunque sean de días anteriores.» |
| Caja → Cierre, Arqueo | «Diferencia estimada: {x}» (efectivo contado − ingresos en efectivo del día, sin descontar gastos) | «Diferencia estimada: {x}» (efectivo contado − efectivo esperado de la vista previa; mismo texto, cálculo corregido) |
| Caja → Cierre, Arqueo | «Cierre registrado. Diferencia final: {x}» (se borraba de inmediato) | Mismo texto; ahora queda visible hasta cambiar la fecha o registrar otro cierre |
| Caja → Cierre | Fecha por defecto: el día UTC (de 19:00 a 23:59 mostraba mañana) | Fecha por defecto: hoy en Bogotá |
| Caja → Cierre | — | Sección «Cierres anteriores», con columnas «Fecha», «Efectivo esperado», «Efectivo contado», «Diferencia», «Observaciones» («—» si no hay) |
| Caja → Cierre | — | «Todavía no hay cierres registrados.» |

---

## 3. Endpoint nuevo — `GET /api/cierres-caja/vista-previa/` (D28)

| Aspecto | Valor |
|---|---|
| Ruta y método | `GET /api/cierres-caja/vista-previa/` |
| Rol | Solo ADMIN (OPERADOR → 403 `PERMISO_INSUFICIENTE`) |
| Bandera | `finanzas_activo` (desactivado → 403 `MODULO_DESACTIVADO`) |
| Efectos | Ninguno: no guarda, no bloquea filas y no asigna `cierre_caja` |
| Criterio | El de D14, igual que `POST /api/cierres-caja/`: movimientos `CONFIRMADO`, `cierre_caja` nulo, `fecha` ≤ `periodo_fin`; `periodo_inicio` = `periodo_fin` del último cierre (o fecha del primer movimiento); `periodo_fin` = momento de la consulta |
| Relación con el Contrato | Extiende el Contrato API v2 §11 (no estaba en el Contrato) |

| Campo | Tipo | Significado |
|---|---|---|
| `periodo_inicio` | fecha-hora ISO (`-05:00`) | Desde cuándo se consolidaría |
| `periodo_fin` | fecha-hora ISO (`-05:00`) | Momento de la consulta |
| `total_ingresos_ventas` | número | Suma de `INGRESO_VENTA` |
| `total_ingresos_abonos` | número | Suma de `INGRESO_ABONO` |
| `total_gastos` | número | Suma de `GASTO` |
| `total_neto` | número | ventas + abonos − gastos |
| `efectivo_esperado` | número | Ingresos en EFECTIVO − gastos en EFECTIVO |
| `por_medio_pago` | objeto `{EFECTIVO, TRANSFERENCIA, QR}` de números | Ingresos (sin gastos) que entrarían al cierre, por medio |
| `cantidad_movimientos` | entero | Movimientos que se consolidarían |

Ejemplo, con una venta en efectivo de $150.000, una venta por QR de $20.000 ya confirmada y un gasto en efectivo de $3.500, sin cierres previos:

```json
// GET /api/cierres-caja/vista-previa/   (Authorization: Bearer <token de ADMIN>)
// Response 200
{
  "periodo_inicio": "2026-10-03T08:02:11.512340-05:00",
  "periodo_fin": "2026-10-03T19:45:03.018822-05:00",
  "total_ingresos_ventas": 170000.0,
  "total_ingresos_abonos": 0.0,
  "total_gastos": 3500.0,
  "total_neto": 166500.0,
  "efectivo_esperado": 146500.0,
  "por_medio_pago": { "EFECTIVO": 150000.0, "TRANSFERENCIA": 0.0, "QR": 20000.0 },
  "cantidad_movimientos": 3
}

// Response 403 — OPERADOR
{ "code": "PERMISO_INSUFICIENTE", "message": "No tiene permisos suficientes para realizar esta operación.", "details": {} }
```

---

## 4. Decisiones nuevas o corregidas en `CLAUDE.md`

| ID | Estado | Resumen |
|---|---|---|
| **D25** | Agregada (faltaba; antes solo estaba en el commit `ef5d035`, `DESPLIEGUE.md`, `render.yaml`, `Dockerfile` y comentarios de `settings.py`) | Un solo Web Service en Render (Docker, plan Free) sirve la API y la PWA en el mismo dominio, sin CORS. PostgreSQL en Neon (plan Free) vía `DATABASE_URL` con SSL obligatorio. `Dockerfile` multietapa que migra y arranca gunicorn en el mismo comando. WhiteNoise sirve el admin y `frontend/dist`; las rutas del cliente caen en `index.html`. Seguridad con `DEBUG=False` y, desde B1, `SECRET_KEY` obligatoria. `GET /api/health/` como health check. Variables: `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`. Un push a `main` despliega. |
| **D19** | Corregida (precisión del lado cliente) | El frontend envía `precio_unitario` SOLO en las operaciones encoladas (`ventas` CREATE RAPIDA, por detalle, y `ventas.detalles` CREATE), con el precio de la copia local del catálogo al agregar; lo omite si el producto no está en la copia; en línea no lo envía. |
| **D22** | Sin cambio de texto | Ya decía que el dispositivo envía el `precio_unitario` mostrado; con B3 ahora es cierto. |
| **D28** | Nueva | `GET /api/cierres-caja/vista-previa/` (§3). Extiende el Contrato v2 §11. El cálculo es compartido con `crear_cierre` (`calcular_totales_cierre`). La «Diferencia estimada» de la PWA usa el `efectivo_esperado` de la vista previa y nunca se envía. |

---

## 5. Lista de verificación manual en navegador (para el equipo)

Lo marcado como verificado en §1 se comprobó con pruebas, comandos o leyendo el build; **nada de lo siguiente se probó en un navegador ni en un dispositivo real**.

1. **Mapa de mesas en modo avión (B4).**
   - Con sesión iniciada y el mapa ya visto una vez en línea, activar el modo avión y recargar Ventas: el mapa aparece, con el aviso de copia local.
   - Abrir una cuenta en una mesa libre y agregar productos; volver al mapa: la mesa sale «Ocupada» con «Total: $ …» y «provisional».
   - Cobrarla: vuelve a «Disponible».
   - Volver a línea: tras sincronizar, el mapa coincide con el servidor y sin «provisional».
2. **Venta sin conexión y sincronización con cambio de precio intermedio (B3).**
   - Dispositivo A sin conexión: venta rápida y cuenta de mesa con un producto de, p. ej., $7.500.
   - Mientras tanto, en otro equipo en línea (ADMIN), subir ese producto a $8.000.
   - Reconectar A: en el detalle de la venta (o en el resumen de caja) la línea debe quedar a **$7.500** (precio del dispositivo, D19), no $8.000.
   - Repetir en línea: debe usar el precio vigente.
3. **Instalar la PWA en Android** (Chrome): «Instalar app» o «Agregar a la pantalla principal»; comprobar el ícono «S» morado (también recortado como círculo o squircle por el lanzador) y el nombre «SADIM».
4. **Instalar la PWA en iOS** (Safari → Compartir → «Agregar a inicio»): comprobar el ícono `apple-touch-icon` (no una captura genérica) y el nombre «SADIM».
5. **`/admin/` con la PWA instalada (B2).** Tras desplegar, abrir la app una vez para que se active el service worker nuevo y luego navegar a `/admin/`: debe salir el login del admin de Django, no la app. Repetir con `/api/health/`.
6. **Flujo completo de cierre con gasto en efectivo (A5).**
   - Hacer una venta en efectivo y registrar un gasto en efectivo.
   - Caja → «Cierre»: «Efectivo esperado» = venta − gasto.
   - Escribir ese efectivo contado: «Diferencia estimada: $ 0».
   - Registrar: «Cierre registrado. Diferencia final: $ 0» sigue visible tras la recarga y el cierre aparece en «Cierres anteriores».
   - Cambiar la fecha: el mensaje desaparece.
   - Probar una diferencia distinta de cero: exige observaciones.
   - Después de las 19:00 (hora de Bogotá), la fecha por defecto debe ser hoy y no mañana.
7. **Formatos de moneda y fecha (A2).** Revisar «$ 12.500» (con separador de miles) en mesas, selector, bandeja, órdenes, catálogo, caja y cierre; fechas «dd/mm/aaaa, h:mm a. m.» en abonos, historial, pagos pendientes, novedades y dispositivos; la entrega estimada de una orden muestra el día correcto (no el anterior).
8. **Mensaje de login sin conexión (A4).** Cerrar sesión, activar el modo avión e intentar entrar: «No hay conexión. El primer inicio de sesión necesita internet.». Con credenciales malas y en línea: el mensaje del servidor. Con cola pendiente de otro usuario: el mensaje de D21.

---

## 6. Problemas vistos y NO corregidos (fuera de alcance)

> Actualización: los puntos 1, 3 y 8 se corrigieron después, en el commit `7326a5a` de la misma rama (pedido aparte del equipo). Los demás siguen pendientes.

1. ~~**Vocabulario restante en el detalle de mesa:** dos mensajes del lote 5 seguían diciendo «sesión».~~ **Corregido en `7326a5a`:** ahora dicen «No se pudo abrir la cuenta.» y «No se pudo actualizar la cuenta.» (`paginas/DetalleSesion.tsx`); filas agregadas a la tabla de §2.
2. **Inventario 00–09 desactualizado:** `03_frontend_pwa.md` y `04a_pantallas_manual_usuario.md` describen el estado del 27/09, anterior a los lotes 4–6: menú con «Ingreso de mercancía» y «Cierre de caja» como secciones, venta rápida con «Agregar al carrito», sin bandeja, sin barra de cuenta en celular, sin cierre por inactividad (D27). Hay que reconciliarlos antes de redactar el manual.
3. ~~**`frontend/public/icons.svg`:** archivo del template de Vite sin uso, precacheado.~~ **Corregido en `7326a5a`:** se borró (ningún archivo lo usaba); ya no aparece en `dist/sw.js` y el precache bajó de 17 a 16 entradas.
4. **Entradas repetidas en el precache:** `favicon.svg`, los PNG y `apple-touch-icon.png` aparecen dos veces en `dist/sw.js`, por `includeAssets`, la lista de íconos del manifest y el glob. Tienen la misma revisión, así que Workbox no falla; es ruido, no un error. `favicon.svg` ya salía duplicado antes de este trabajo.
5. **Lint:** 12 advertencias `react(set-state-in-effect)` y una `only-export-components`, todas de patrones que ya existían (`setCargando(true)` al inicio de una carga dentro de `useEffect`; `useSesion` exportado junto al proveedor). 0 errores.
6. **A4, detección de «sin red»:** se usa `TypeError` porque es lo que lanza `fetch` sin red. Un `TypeError` que no sea de red durante el login también mostraría el mensaje de sin conexión. Es poco probable, pero conviene saberlo.
7. **Resumen del día vs. vista previa del cierre:** pueden mostrar cifras distintas. El resumen es por día local e incluye pendientes; el cierre consolida todo lo confirmado no cerrado, de cualquier día (D14). El texto de ayuda lo explica, pero el manual debe aclararlo.
8. ~~**`CLAUDE.md` con datos desactualizados fuera de las decisiones.**~~ **Corregido en `7326a5a`:** «Comandos del proyecto» ahora dice service worker activo, 194 pruebas de backend y 38 de Vitest en 7 archivos.
9. **Esta carpeta (`docs/insumos_documentacion/`) no está versionada en git:** este informe tampoco quedó en ningún commit. Hay que decidir si se versiona.

---

## 7. Merge a `main` (cuando el equipo apruebe)

> **Antes del push:** en Render → servicio `sadim` → *Environment*, confirmar que **`SECRET_KEY` está definida**. Desde B1, con `DEBUG=False` y sin `SECRET_KEY`, Django lanza `ImproperlyConfigured` y el servicio no arranca. Un push a `main` despliega de inmediato.

```bash
# 1. Revisar los cambios
git log --oneline main..correcciones-pre-documentacion
git diff --stat main..correcciones-pre-documentacion

# 2. Verificar en la rama (opcional, ya se hizo; ver §8)
python backend/manage.py test usuarios inventario core ventas finanzas servicios
cd frontend && npm test && npx tsc -b && npm run lint && npm run build && cd ..

# 3. Fusionar (main no ha avanzado desde 02ce97b: es fast-forward)
git checkout main
git merge --ff-only correcciones-pre-documentacion

# 4. CONFIRMAR SECRET_KEY EN RENDER y luego publicar (esto despliega)
git push origin main

# 5. Limpiar la rama local
git branch -d correcciones-pre-documentacion
```

---

## 8. Verificación final (salida real, 03/10/2026)

```text
$ python backend\manage.py test usuarios inventario core ventas finanzas servicios
Ran 194 tests in 14.244s

OK
Destroying test database for alias 'default'...
Found 194 test(s).
System check identified no issues (0 silenced).

$ python backend\manage.py makemigrations --check --dry-run
No changes detected
(código de salida: 0)

$ npm test
 Test Files  7 passed (7)
      Tests  38 passed (38)
(código: 0)

$ npx tsc -b
(código: 0, sin salida)

$ npm run lint
(código: 0) — 0 errores; 12 advertencias preexistentes (ver §6.5)

$ npm run build
PWA v1.3.0
mode      generateSW
precache  17 entries (548.28 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

`dist/manifest.webmanifest`:

```json
{"name":"SADIM","short_name":"SADIM","description":"PWA offline-first para micro-comercios y negocios de servicios.","start_url":"/","display":"standalone","background_color":"#ffffff","theme_color":"#aa3bff","lang":"es","scope":"/","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"},{"src":"/favicon.svg","sizes":"any","type":"image/svg+xml","purpose":"any"}]}
```

`dist/sw.js`, ruta de navegación y PNG en el precache:

```text
NavigationRoute(e.createHandlerBoundToURL("index.html"),{denylist:[/^\/api\//,/^\/admin\//]})
{url:"apple-touch-icon.png",…} {url:"icon-192.png",…} {url:"icon-512.png",…} {url:"icon-maskable-512.png",…}
```

Las pruebas pasaron de 188 a 194 en el backend (+6 de `VistaPreviaCierreTests`) y de 22 a 38 en Vitest (+7 de formato, +3 de etiquetas, +1 de novedades, +2 de precio en la cola, +3 del mapa local).
