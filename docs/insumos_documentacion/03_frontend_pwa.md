Actualizado al commit 49e6f17 (04/10/2026)

# 03 — Frontend y PWA

> Rutas relativas a `frontend/` salvo indicación. «Offline» se determinó leyendo el código (qué llamadas hace cada pantalla y qué hacen sin red); no se probó en un navegador real. La versión anterior (02/10, commit `8910c90`) era previa a los lotes de corrección 4–6 (E-10…E-19) y a la rama `correcciones-pre-documentacion` (informe `10`). Esta versión describe `main` en `7326a5a`.

---

## 1. Estructura y patrón

```
src/
├── main.tsx            ← registra el service worker (registerSW) y monta <BrowserRouter><SesionProvider><App/>
├── App.tsx             ← tabla de rutas (react-router-dom 7)
├── api/                ← un módulo por recurso del Contrato (19 archivos + ventas.test.ts); todos usan api/cliente.ts
│   ├── cliente.ts      ← fetch a /api con Bearer, renovación automática del token, errores {code,message,details}
│   ├── errorApi.ts, erroresPorCampo.ts, eventosSesion.ts
│   ├── mapaMesas.ts    ← NUEVO (B4): mapa de mesas desde el servidor o desde la copia local
│   └── auth, catalogo, mesas, ventas, ordenesTrabajo, inventarioStock, inventarioMovimientos,
│       caja, cierres, configuracion, usuarios, dispositivos, novedades, sync
├── componentes/        ← Layout (barra lateral; en celular, barra superior + barra inferior), navegacion.ts,
│                         rutas protegidas, formularios (Categoria, Producto, Mesa, Usuario, Orden, VentaRapida),
│                         SelectorProductos, ContadorCantidad, IndicadorConectividad, AvisoLocal,
│                         BandejaSeleccion + bandeja.ts + useBandejaPersistente.ts (E-12/E-17/E-19),
│                         PanelMovimientoInventario (E-13), PanelCierreCaja (E-18, A5)
├── contexto/           ← SesionContext.tsx (sesión + módulos), erroresSesion.ts (A4),
│                         inactividad.ts + inactividad.test.ts (D27)
├── db/baseLocal.ts     ← Dexie (IndexedDB)
├── paginas/            ← 14 pantallas (se eliminaron IngresoMercancia.tsx y CierreCaja.tsx)
├── sync/               ← enrutador de escrituras, motor, reconciliación, vistas locales "provisionales"
│                         (órdenes, inventario/caja, ventas y vistaLocalMesas.ts — NUEVO, B4), pruebas Vitest
├── utilidades/         ← NUEVO: formato.ts (moneda COP y fechas de Bogotá, A2), etiquetas.ts (A6/A7) y sus pruebas
└── tipos/dominio.ts    ← tipos con los nombres exactos del ERD/Contrato (+ VistaPreviaCierre, A5)
```

Patrón: las páginas llaman funciones de `api/`. No hay librería de estado (Redux/Zustand): estado local con `useState`/`useEffect` y un único contexto (`SesionContext`). Toda escritura sincronizable pasa por `sync/enrutador.ts::escribir`, que decide si va en línea o a la cola. Los montos y fechas que se muestran pasan por `utilidades/formato.ts`; es solo presentación y nada formateado se envía al servidor (`utilidades/formato.ts:1-8`).

---

## 2. Rutas

Fuente: `src/App.tsx:21-50`. Todas las rutas salvo `/login` están dentro de `RutaProtegida` (exige sesión) y de `Layout`. `RutaSoloAdmin` redirige a `/` a quien no sea ADMIN (`App.tsx:39-45`). Las rutas **no** se bloquean por bandera de módulo: la bandera solo oculta el ítem del menú. Si se entra por URL, el backend responde 403 `MODULO_DESACTIVADO` y la página muestra ese mensaje.

| Ruta | Componente | Título (h1) | Roles | Bandera | ¿Offline? |
|---|---|---|---|---|---|
| `/login` | `Login` | «SADIM» / «Inicia sesión para continuar» | Público | — | La pantalla abre (shell en caché), pero iniciar sesión **requiere conexión**. Sin red muestra «No hay conexión. El primer inicio de sesión necesita internet.» (`paginas/Login.tsx:14-21`) |
| `/` | `Inicio` | «Hola, Administrador» / «Hola, Operador» | ADMIN, OPERADOR | — | Sí |
| `/ventas` | `Ventas` | «Ventas» | ADMIN, OPERADOR | ventas | **Sí**: sin conexión o con cola pendiente, el mapa de mesas sale de la copia local (B4, `api/mapaMesas.ts:20-35`). La venta rápida se encola |
| `/ventas/mesas/:mesaId` | `DetalleSesion` | «Mesa {número}» (o «Cuenta») | ADMIN, OPERADOR | ventas | Sí (copia local + cola; la bandeja se guarda en el dispositivo) |
| `/inventario` | `Inventario` | «Inventario» | ADMIN, OPERADOR (Merma/Ajuste solo ADMIN) | inventario | Sí (stock provisional; Ingreso, Merma y Ajuste se encolan) |
| `/inventario/ingreso` | `Navigate → /inventario` | — | — | — | Redirección (E-13, `App.tsx:31-32`) |
| `/ordenes` | `Ordenes` | «Órdenes de trabajo» | ADMIN, OPERADOR | servicios | Sí (copia local + cola) |
| `/ordenes/:ordenId` | `DetalleOrden` | «Orden de {cliente}» | ADMIN, OPERADOR (costos solo ADMIN) | servicios | Sí, si la orden está en la copia local |
| `/caja` | `Caja` | «Caja» (con pestañas, ver §12) | ADMIN, OPERADOR («Resumen del día» y «Cierre» solo ADMIN) | finanzas | Gastos: sí (cola). Confirmar/anular, Resumen del día y Cierre: **no** («Requiere conexión») |
| `/caja/cierre` | `Navigate → /caja?pestana=cierre` | — | — | — | Redirección (E-18, `App.tsx:36-37`) |
| `/novedades` | `Novedades` | «Novedades» | ADMIN, OPERADOR | — | Lectura de la copia local; «Marcar atendida» deshabilitado |
| `/catalogo` | `Catalogo` | «Catálogo» | ADMIN | — | Lectura sí; **crear/editar NO** (F-2, sigue abierto) |
| `/mesas` | `Mesas` | «Mesas» | ADMIN | ventas (solo menú) | Sí (crear y activar/desactivar se encolan) |
| `/usuarios` | `Usuarios` | «Usuarios» | ADMIN | — | No (botones «Requiere conexión») |
| `/configuracion` | `Configuracion` | «Configuración» | ADMIN | — | Módulos: sí (se encola). Medios de pago: no |
| `/dispositivos` | `Dispositivos` | «Dispositivos» | ADMIN | — | No |
| `*` | `Navigate to="/"` | — | — | — | — |

Ya no existen pantallas propias para «Ingreso de mercancía» ni «Cierre de caja». Las URL viejas redirigen, así que un marcador o enlace antiguo sigue funcionando.

---

## 3. Menú de navegación por rol

Fuente única: `componentes/navegacion.ts:43-74` (`useElementosNavegacion`). La usan la barra lateral (escritorio), la barra inferior y la hoja «Más» (celular), y los accesos rápidos de Inicio (`paginas/Inicio.tsx:23`). Orden exacto, con todos los módulos activos (`navegacion.ts:51-68`):

| # | Etiqueta (escritorio) | Etiqueta corta (celular) | Ícono | ADMIN | OPERADOR | Se oculta si… |
|---|---|---|---|---|---|---|
| 1 | Inicio | Inicio | 🏠 | ✔ | ✔ | — |
| 2 | Ventas | Ventas | 🛒 | ✔ | ✔ | `ventas_activo=false` |
| 3 | Mesas | Mesas | 🍽️ | ✔ | — | `ventas_activo=false` |
| 4 | Inventario | Stock | 📦 | ✔ | ✔ | `inventario_activo=false` |
| 5 | Órdenes | Órdenes | 🧾 | ✔ | ✔ | `servicios_activo=false` |
| 6 | Caja | Caja | 💵 | ✔ | ✔ | `finanzas_activo=false` |
| 7 | Novedades | Avisos | 🔔 | ✔ | ✔ | — |
| 8 | Catálogo | Catálogo | 📋 | ✔ | — | — |
| 9 | Usuarios | Usuarios | 👤 | ✔ | — | — |
| 10 | Configuración | Config. | ⚙️ | ✔ | — | — |
| 11 | Dispositivos | Equipos | 📱 | ✔ | — | — |

- **ADMIN** (11): Inicio, Ventas, Mesas, Inventario, Órdenes, Caja, Novedades, Catálogo, Usuarios, Configuración, Dispositivos.
- **OPERADOR** (6): Inicio, Ventas, Inventario, Órdenes, Caja, Novedades.
- Se quitaron «Ingreso de mercancía» (E-13) y «Cierre de caja» (E-18).
- Si la configuración de módulos no carga (por ejemplo, sin red y sin copia), `modulos` queda en `null` y el menú muestra todo (`navegacion.ts:45-48`).

### 3.1 Escritorio (≥ 768 px)

Barra lateral (`componentes/Layout.tsx:101-123`): marca «SADIM» y lista de secciones con la etiqueta larga. En el pie: indicador de conectividad, **nombre de usuario** (nuevo, E-16), rol («Administrador» u «Operador») y botón «Cerrar sesión».

### 3.2 Celular (< 768 px)

| Zona | Contenido | Evidencia |
|---|---|---|
| **Barra superior fija** (nueva, E-16) | Marca «SADIM» y botón de cuenta «👤 {usuario}» (`aria-label="Cuenta"`). Al tocarlo se abre un panel con el usuario, el rol, el indicador de conectividad y «Cerrar sesión». Es igual para ambos roles y no depende de cuántas secciones haya | `Layout.tsx:128-154` |
| **Barra inferior** | Máximo 5 elementos. Si hay más de 5 secciones, se ven las 4 primeras y «Más»; con 5 o menos, todas, sin «Más» | `Layout.tsx:81-83`, `:173-194` |
| **Hoja «Más»** | Las secciones restantes con la etiqueta larga; en el pie, el indicador, el rol y «Cerrar sesión» | `Layout.tsx:196-228` |

Con todos los módulos activos:
- **ADMIN:** Inicio · Ventas · Mesas · Stock · Más. En «Más»: Órdenes, Caja, Novedades, Catálogo, Usuarios, Configuración, Dispositivos.
- **OPERADOR:** Inicio · Ventas · Stock · Órdenes · Más. En «Más»: Caja, Novedades.
- Con un módulo apagado, el OPERADOR queda con 5 secciones y no aparece «Más». Antes de E-16 eso lo dejaba sin forma de cerrar sesión, porque el botón solo estaba en la hoja «Más» (causa explicada en el commit `02ce97b`). Ahora la barra superior siempre lo ofrece.
- El usuario que se muestra es el `username` escrito en el login. El Contrato no devuelve el nombre, así que se guarda solo en la sesión local (`api/auth.ts:6-14`). Si la sesión es anterior a E-16 y no lo tiene, se muestra «Usuario» (`Layout.tsx:86`).

---

## 4. Manifest

Generado por `vite-plugin-pwa` desde `vite.config.ts:18-33` (A1, commit `1bf76fc`):

| Campo | Valor |
|---|---|
| name / short_name | SADIM / SADIM |
| description | PWA offline-first para micro-comercios y negocios de servicios. |
| start_url / scope | / |
| display | standalone |
| theme_color | `#aa3bff` (antes `#863bff`; ahora igual al `--accent` de `index.css`) |
| background_color | `#ffffff` |
| lang | `es` |
| icons | `icon-192.png` (192×192, any), `icon-512.png` (512×512, any), `icon-maskable-512.png` (512×512, maskable), `favicon.svg` (any) |

`index.html` (`:2`, `:6`, `:8-11`): `<html lang="es">`, `<title>SADIM</title>`, `meta description` «SADIM: ventas, mesas, órdenes de trabajo, inventario y caja para micro-comercios, también sin conexión.», `meta theme-color #aa3bff`, `apple-mobile-web-app-title` «SADIM» y `link rel="apple-touch-icon" href="/apple-touch-icon.png"` (180×180). Logo: `public/logo-sadim.svg`, una «S» blanca sobre un cuadrado morado de esquinas redondeadas; `favicon.svg` usa el mismo dibujo. Se borraron los recursos del template de Vite (`src/assets/*`, `public/icons.svg`).

---

## 5. Service worker

| Aspecto | Valor | Evidencia |
|---|---|---|
| Herramienta | `vite-plugin-pwa` 1.3.0 → Workbox 7.4.1 (`generateSW`) | `vite.config.ts:13-45` |
| Registro | `registerSW({ immediate: true })` | `src/main.tsx` |
| Actualización | `registerType: 'autoUpdate'`: el SW nuevo se activa solo, **sin preguntar** al usuario | `vite.config.ts:14` |
| Precaché | `globPatterns: ['**/*.{js,css,html,svg,png}']` + `includeAssets: ['favicon.svg','apple-touch-icon.png']`. 16 entradas tras `7326a5a` (informe 10 §6.3). Algunos íconos aparecen dos veces, sin efecto práctico (informe 10 §6.4) | `vite.config.ts:15`, `:43` |
| Navegaciones | `NavigationRoute` → `index.html`, **excepto** `/api/*` y `/admin/*` (`navigateFallbackDenylist`, B2, `fc6c598`) | `vite.config.ts:39-42` |
| Llamadas `/api/` | **No se cachean** en el SW (sin `runtimeCaching`); las resuelve el código de la app con IndexedDB | `vite.config.ts:35-38` |
| Servidor | `sw.js`, `index.html` y `manifest.webmanifest` con `max-age=0`; `/assets/*` inmutables por 1 año | `backend/core/settings.py:190-200` |

Con el SW instalado, `/admin/` y `/api/health/` ya llegan a Django. Antes devolvían la app (F-10, corregido).

---

## 6. IndexedDB / Dexie

Base **`sadim`**, versión de esquema **2** (`db/baseLocal.ts`). Los lotes 4–6 y la rama de correcciones **no cambiaron el esquema**: lo nuevo se guarda en claves de `meta`.

| Tabla | Clave primaria | Índices | Qué guarda |
|---|---|---|---|
| `meta` | `clave` | — | `sesion` (`access_token`, `refresh_token`, `usuario_id`, `rol` y, desde E-16, `username`), `device_id`, `ultima_sincronizacion`, `modulos`, `configuracion_pagos`, `propietario_cola` (D21), `ventas_abiertas` (también la usa el mapa local, B4), `ordenes_no_entregadas`, copias de lectura `copia:*`, y las **bandejas de selección** `bandeja:mesa:{id}` y `bandeja:venta-rapida` (E-19, `db/baseLocal.ts:174-198`) |
| `catalogo` | `[recurso+id]` | `recurso` | Copia de lectura de `categorias`, `productos` y `mesas` |
| `operaciones_locales` | `operation_id` | `resource`, `id`, `referencia_id` | Cada escritura encolada con su `payload`, para reconstruir vistas provisionales |
| `cola_sincronizacion` | `operation_id` | `creado_en` | Operaciones pendientes |
| `novedades` | `operation_id` | `atendida` | Resultados RECHAZADA/CONFLICTO con su **estado real** (B5, `1984aec`) |

Una bandeja guardada se borra al enviarla con éxito, al vaciarla o descartarla, y al cerrar sesión (`borrarBandejasLocales`, llamado en `contexto/SesionContext.tsx:89`). Nunca se envía al servidor por sí sola.

---

## 7. Cola de sincronización

| Aspecto | Implementación | Evidencia |
|---|---|---|
| Generación de `operation_id` | `uuid` v4 en `escribir()` y en cada llamada en línea; los ids de los objetos también se generan en el cliente | `sync/enrutador.ts`; `api/ventas.ts` |
| Id de dispositivo | `crypto.randomUUID()` (exige HTTPS o `localhost`; F-12 sigue abierto) | `db/baseLocal.ts:107` |
| Regla de ruteo | Con `navigator.onLine` = true **y** cola vacía → llamada en línea; si no → se encola. El mapa de mesas usa la misma regla para LEER (`debeEscribirEnLinea`) | `sync/enrutador.ts`; `api/mapaMesas.ts:21` |
| Disparadores | Al encolar; al abrir la app con sesión; evento `online`; intervalo de **15 s** del `IndicadorConectividad` | `contexto/SesionContext.tsx:49-58`; `componentes/IndicadorConectividad.tsx:22-36` |
| Botón «Sincronizar ahora» | NO ENCONTRADO | búsqueda en `src/` |
| Orden y tamaño | Por `creado_en`, en lotes de 200; nunca dos sincronizaciones a la vez | `sync/motor.ts`, `sync/almacenDexie.ts` |
| Respuestas | APLICADA/DUPLICADA → salen de la cola. RECHAZADA/CONFLICTO → salen de la cola y se guardan en `novedades` con su estado real. Antes siempre quedaban como `RECHAZADA` (F-11, corregido en `1984aec`, función `filaNovedadLocal()`) | `sync/motor.ts`; `sync/almacenDexie.ts` |
| Precio en el payload (D19/D22) | **Se envía** `precio_unitario` SOLO en lo que se encola: `ventas` CREATE RAPIDA (en cada detalle) y `ventas.detalles` CREATE, con el `precio_venta` de la copia local del catálogo. Se omite si el producto no está en la copia. En línea no se envía (F-9, corregido en `20907da`) | `api/ventas.ts:47-49`, `:105`, `:180`; `api/ventas.test.ts` |
| Indicador | «En línea» / «Sin conexión» y «{n} operación(es) pendiente(s) de sincronizar» | `componentes/IndicadorConectividad.tsx:46-54` |

Recursos que el frontend encola: `ventas`, `ventas.detalles` (CREATE/DELETE), `ventas.cerrar`, `ventas.cancelar`, `mesas`, `ordenes-trabajo`, `.estado`, `.abonos`, `.consumos`, `.costos`, `inventario.movimientos`, `movimientos-caja` y `configuracion.modulos`. **No** encola `categorias` ni `productos` (F-2).

---

## 8. Sesión offline (D21, D23)

- La sesión se guarda en `meta.sesion` (nunca en `localStorage`).
- Al abrir la app se lee la sesión de Dexie; si existe, se entra sin pedir login aunque no haya red (`contexto/SesionContext.tsx:49-58`).
- El access vence a los 30 min y el refresh a los 7 días (backend, D23). En línea, un 401 dispara una renovación. Si la renovación falla, el cliente borra la sesión (no la cola) y lleva a `/login` con «La sesión terminó. Vuelve a iniciar sesión.» (`api/cliente.ts:72-85`). Sin red no se borra nada.
- D21: no se puede cerrar sesión con operaciones pendientes: «Hay {n} operación(es) sin sincronizar. Conéctate para sincronizar antes de cerrar sesión.» (`SesionContext.tsx:81-86`). Tampoco se puede entrar con otro usuario. Ese error es ahora la clase `ErrorColaDeOtroUsuario` (`contexto/erroresSesion.ts:6-11`), y su texto sí se ve en el login (F-3, corregido en `dca9f68`).
- **Sin red se puede:** ver Inicio, el mapa de mesas y las cuentas de mesa, hacer ventas rápidas, usar Inventario (consulta e ingreso; merma y ajuste solo ADMIN), órdenes y su detalle, registrar gastos, crear/activar mesas (ADMIN), cambiar módulos (ADMIN) y ver las copias del catálogo y las novedades.
- **Sin red no se puede:** iniciar sesión, crear/editar el catálogo (F-2), usuarios, medios de pago, dispositivos, confirmar o anular pagos, el Resumen del día, la vista previa y el registro del cierre, ni ver los cierres anteriores.

---

## 9. Cierre de sesión por inactividad (D27) y su relación con D21 y D23

### 9.1 Cómo está implementado

| Aspecto | Valor | Evidencia |
|---|---|---|
| Constante única | `INACTIVIDAD_SESION = { limiteMs: 30 min, avisoMs: 1 min, reintentoMs: 15 s }` | `contexto/inactividad.ts:7-11` |
| Dónde corre | Un `TemporizadorInactividad` creado en `Layout`: solo existe con sesión iniciada y aplica a ambos roles | `componentes/Layout.tsx:51-116` |
| Qué cuenta como actividad | `pointerdown`, `pointermove`, `keydown`, `wheel`, `touchstart` y `scroll` (como máximo una vez por segundo) | `Layout.tsx:16`, `:68-79` |
| Estados | `ACTIVA` → `AVISO` (minuto 29) → cierre, o `EXPIRADA_PENDIENTE` si no se puede cerrar | `inactividad.ts:20`, `:123-164` |
| Condición para cerrar (F-19) | `navigator.onLine` **y** `contarOperacionesPendientes() === 0` **y** `servidorDisponible()`: `GET /api/health/` sin token, con `cache: 'no-store'` y máximo 5 s (`AbortController`); true solo con 200 | `Layout.tsx:53-54`; `api/salud.ts` |
| Comprobación asíncrona (F-19) | Mientras corre `puedeCerrar` (hasta 5 s esperando al servidor) no se lanza otra (`comprobando`); si hubo actividad durante la comprobación, el resultado se ignora y no se cierra (contador `ciclo`, E-15) | `inactividad.ts:76-78`, `:141-155` |
| Qué hace al cerrar | Llama a `cerrarSesion()` del contexto, que vuelve a revisar la cola (D21) y borra la sesión, `ultima_actividad` y las bandejas. **No** toca la cola, la copia local ni el id del dispositivo. Luego navega a `/login` | `Layout.tsx:55-64`; `SesionContext.tsx:79-92`; `db/baseLocal.ts:96-98` |
| Si entró algo a la cola justo al cerrar | `cerrarSesion` lanza el error de D21 y el temporizador vuelve a empezar desde cero | `Layout.tsx:59-62` |
| Reintentos | En `EXPIRADA_PENDIENTE`, cada 15 s y al recibir el evento `online` | `inactividad.ts:117-121`, `:161-162`; `Layout.tsx:87`, `:103` |
| Actividad después de expirar (E-15) | Reinicia la cuenta de 30 min: si el usuario sigue trabajando, la sesión no se cierra cuando la cola se vacía | `inactividad.ts:106-114` |
| Última actividad guardada (F-20) | `meta.ultima_actividad` (ms) en Dexie: se escribe como máximo cada 30 s y al ocultar la página (`visibilitychange` a `hidden`, `pagehide`); vale ahora al iniciar sesión; se borra junto con la sesión | `Layout.tsx:18`, `:75-86`, `:104-105`; `api/auth.ts:14`; `db/baseLocal.ts:83`, `:97`, `:104-111` |
| Al abrir la app (F-20) | `calcularInicioInactividad(ultima_actividad, ahora)` (función pura): sin valor → empieza ahora; menos de 30 min → la cuenta sigue desde ahí; 30 min o más → se aplica de inmediato la condición de cierre; valor en el futuro → se toma como ahora. `iniciar(transcurridoMs)` arranca el temporizador con ese tiempo | `Layout.tsx:91-99`; `inactividad.ts:32-42`, `:91-99` |
| Pruebas | 14 en `contexto/inactividad.test.ts` (5 de D27/E-15, 3 de F-19, 2 del temporizador con tiempo transcurrido y 4 de `calcularInicioInactividad`) y 3 en `api/salud.test.ts` | `inactividad.test.ts`; `salud.test.ts` |

Textos en pantalla, encima del contenido (`Layout.tsx:197-209`), sin cambios en esta revisión:
- `AVISO`: «Por inactividad, la sesión se cerrará en 60 segundos. Toca la pantalla para seguir trabajando.»
- `EXPIRADA_PENDIENTE`: «La sesión expiró por inactividad. No se cierra todavía porque no hay conexión o quedan operaciones sin sincronizar. Si sigues trabajando, la sesión continúa; si no, se cerrará apenas haya conexión y todo quede sincronizado.»

### 9.2 Respuestas concretas

**a) ¿Qué pasa si vence la inactividad con cola pendiente?**
La sesión **no** se cierra.
- Al minuto 30, `puedeCerrar` devuelve false porque la cola no está vacía. El estado pasa a `EXPIRADA_PENDIENTE`, aparece el segundo aviso y se reintenta cada 15 s (`inactividad.ts:95-110`).
- Cuando el motor sincroniza y la cola llega a cero, el siguiente reintento cierra la sesión y lleva al login, siempre que nadie haya tocado la pantalla. Si alguien la toca, la cuenta vuelve a 30 minutos (E-15).
- Si la cola cambia en el último instante, `cerrarSesion()` la vuelve a contar y no cierra (D21, `SesionContext.tsx:81-86`).
- Las operaciones nunca se pierden: ni D27 ni `cerrarSesion` borran la cola.

**b) ¿Qué pasa si vence sin red, o con red pero sin servidor?**
Tampoco se cierra.
- Sin red, `navigator.onLine` es false; con red pero sin servidor (wifi sin internet, portal cautivo, Render dormido), `servidorDisponible()` devuelve false (F-19). En ambos casos el estado pasa a `EXPIRADA_PENDIENTE` con el mismo aviso. El temporizador reintenta cada 15 s y al evento `online`.
- Si al volver la red la cola está vacía, la sesión se cierra en ese momento.
- Si hay operaciones hechas sin conexión, primero se sincronizan. Si mientras tanto venció el refresh de 7 días, el cliente pide login (D23) y solo acepta al mismo usuario (D21).

**c) ¿Puede el usuario quedar fuera, sin poder volver a entrar, mientras no haya conexión?**
**Por diseño, no**: desde F-19, D27 solo cierra si el servidor acaba de responder `GET /api/health/` con 200, y volver a entrar exige conexión (D23; `paginas/Login.tsx:14-21`). Quedan dos situaciones en que sí puede pasar (la 2 y la 3). Salen de leer el código y **no se probaron en un dispositivo**:
1. ~~**«Conexión» aparente (F-19).**~~ **Corregido en `24e7c46`.** Antes bastaba `navigator.onLine`, que solo indica que hay una red local: con el wifi sin internet, un portal cautivo o Render dormido (plan Free, `06 §2`), D27 cerraba la sesión y el operador no podía volver a entrar ni vender. Ahora esos casos pasan a `EXPIRADA_PENDIENTE`. Margen que queda: el servidor responde al health check y se cae en los segundos siguientes, antes del nuevo login.
2. **La red cae justo después de un cierre correcto.** Es el límite propio de D27: entre el cierre y el nuevo login no hay sesión, y entrar exige conexión.
3. **Dos pestañas abiertas (inferido).**
   - Cada pestaña tiene su propio temporizador.
   - Si la pestaña inactiva cierra la sesión, borra `meta.sesion`, pero la otra sigue mostrando pantallas con una sesión que ya no existe.
   - Las llamadas en línea de esa otra pestaña responden 401 sin intentar renovar el token, porque ya no hay sesión guardada (`api/cliente.ts:72`).

**Observaciones adicionales (F-20):**
- ~~La última actividad no se guardaba: cerrar y volver a abrir la app reiniciaba la cuenta.~~ **Corregido en `7688cb7`:** se guarda en `meta.ultima_actividad` y, al abrir la app, la cuenta sigue desde ahí; si ya pasaron 30 min, se aplica de inmediato la condición de cierre (§9.1).
- Sigue abierto: en un celular con la pantalla apagada, el navegador puede retrasar los temporizadores, así que el cierre puede llegar tarde. F-20 recalcula al abrir la app, no al volver a mostrarla (inferido).

### 9.3 ¿Hay conflicto con ADR-004, D21 o D23?

- **ADR-004** (`docs/referencia/01_ADR_Arquitectura_SADIM.md:108-134`: cola local con `operation_id`, «ninguna operación sincronizada se descarta en silencio»).
  - **No hay conflicto en los datos.** D27 nunca borra la cola ni la copia local y solo cierra con la cola vacía.
  - **Sí hay una tensión de continuidad.** El contexto de ADR-004 (`:106`) pide «continuidad operativa ante conectividad inestable», y CU-17 (`03_Casos_de_Uso_SADIM.md:607`, `:631`) permite seguir offline con «una sesión previamente validada y vigente». En la situación 1 de §9.2 c), D27 deja al operador sin sesión y sin forma de recuperarla mientras el servidor no responda.
  - Se reportó como riesgo (F-19) y **se corrigió en `24e7c46`**: la condición de cierre exige que el servidor responda.
- **D21:** sin conflicto. Se respeta dos veces: en `puedeCerrar` y en `cerrarSesion`.
- **D23:** sin conflicto con su texto, que trata el vencimiento del refresh y dice que la cola nunca se borra.
  - D27 agrega una segunda forma de perder la sesión (la inactividad), que D23 no menciona. En ambos casos, volver a entrar exige conexión y el mismo usuario si hay cola.
  - D27 en CLAUDE.md reconoce el riesgo de que «el operador quedaría bloqueado a mitad de turno» y lo resuelve exigiendo conexión. Desde F-19, «conexión» significa que `GET /api/health/` responde 200, no solo `navigator.onLine` (ajuste registrado en D27).

---

## 10. Bandeja de selección (E-12, E-17, E-19)

Reemplaza el envío temporizado de E-10 (`useAcumuladorClics`, eliminado en `6caa42a`). Componentes: `componentes/BandejaSeleccion.tsx`, `componentes/bandeja.ts` y `componentes/useBandejaPersistente.ts`.

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Agregar | Cada toque en la tarjeta de un producto suma 1 a la bandeja (una sola línea por producto). La tarjeta muestra «+{n}» con lo acumulado | `bandeja.ts:14-21`; `SelectorProductos.tsx:92-96` |
| Editar | En cada línea: nombre, precio, contador «−»/«+» y «Quitar» | `BandejaSeleccion.tsx:96-127` |
| Total | «Total estimado: {total} (lo confirma el servidor)», solo informativo | `BandejaSeleccion.tsx:131-133` |
| Envío | Nunca por tiempo ni al salir: solo con el botón. En la mesa, «Agregar a la mesa ({n})» envía una petición por producto, en orden; si la cuenta no existe, la abre primero (D26). En la venta rápida, la bandeja es el carrito y el botón es «Cobrar ({n})» | `DetalleSesion.tsx:191-250`; `FormularioVentaRapida.tsx:70-93` |
| Errores | Si falla una línea, queda en la bandeja con su mensaje. Si falla la primera línea de una cuenta recién abierta, la cuenta se cancela sola | `DetalleSesion.tsx:216-242` |
| Escritorio | Panel «Selección» al lado del selector, con lista desplazable | `App.css` (`@media (min-width: 1024px)`) |
| Celular (E-17) | Barra compacta fija encima de la barra de navegación: «{n} productos · {total}» y un botón corto («Agregar» o «Cobrar»). Al tocarla se abre como hoja de máximo media pantalla, con «Ocultar». En la venta rápida, el botón compacto solo abre la hoja, porque antes hay que elegir el medio de pago | `BandejaSeleccion.tsx:65-92`; `FormularioVentaRapida.tsx:155` |
| Persistencia (E-19) | Se guarda en Dexie, una por mesa y otra para la venta rápida. El gesto «atrás» o cerrar la app no la borran | `useBandejaPersistente.ts:13-55` |
| Salir con bandeja | En la mesa, un clic en un enlace o en «Volver al mapa de mesas» abre el diálogo «Productos sin agregar»; recargar muestra el aviso del navegador; cobrar pregunta «¿Cerrar la cuenta sin ellos?». En la venta rápida, «Cancelar» pregunta «¿Descartar la venta?» | `DetalleSesion.tsx:120-146`, `:447-465`, `:505-530`; `FormularioVentaRapida.tsx:95-135` |
| Aviso de stock (D22) | Sin conexión o con cola, si la cantidad supera el stock local: «Supera el stock que se ve en este dispositivo; puede generar un conflicto al sincronizar.» No bloquea | `DetalleSesion.tsx:313-325` |

En el detalle de mesa, las líneas del mismo producto se **agrupan solo en pantalla**: se suman cantidad y subtotal, y el precio dice «Varios» si difiere. «Quitar» borra la línea más reciente; si hay varias, el botón dice «Quitar últimos {n}» (`DetalleSesion.tsx:46-68`, `:358-376`).

---

## 11. Inventario con el ingreso de mercancía (E-13)

Es una sola pantalla, `paginas/Inventario.tsx`, con el panel `componentes/PanelMovimientoInventario.tsx`:
- **Escritorio:** tabla de existencias a la izquierda y panel «Registrar movimiento» fijo a la derecha.
- **Celular:** la tabla ocupa la pantalla y el botón «Registrar movimiento» abre el panel como hoja, con «Cerrar» (`Inventario.tsx:68-73`, `:193-210`).
- **Panel:** pestañas «Ingreso» (ambos roles), «Merma» y «Ajuste» (solo ADMIN). El OPERADOR no ve pestañas, solo el formulario de ingreso (`PanelMovimientoInventario.tsx:54-62`, `:111-126`).
- **Clic en una fila:** muestra «Historial — {producto}» y precarga ese producto en el panel (`Inventario.tsx:54-57`, `:204-208`).
- El historial usa etiquetas legibles, como «Ingreso de mercancía» o «Salida por venta» (A7, `utilidades/etiquetas.ts:17-32`).

## 12. Caja con pestañas (E-18)

`paginas/Caja.tsx:44-56`:
- «Gastos» y «Pagos pendientes»: ambos roles. «Resumen del día» y «Cierre»: solo ADMIN.
- La pestaña activa va en la URL (`?pestana=gastos|pendientes|resumen|cierre`). Un valor desconocido o no permitido abre «Gastos».
- «Resumen del día» y «Cierre» las dibuja `componentes/PanelCierreCaja.tsx` (antes `paginas/CierreCaja.tsx`). Desde A5 ese panel usa `GET /api/cierres-caja/vista-previa/` (D28) y lista los cierres anteriores.

Detalle de los textos en `04a`, P-12 y P-13.

---

## 13. Compatibilidad real

| Fuente | Valor | Evidencia |
|---|---|---|
| Build target de Vite | Sin `build.target` → `baseline-widely-available` = Chrome/Edge 111, Firefox 114, Safari/iOS 16.4 | `vite.config.ts` |
| browserslist / `@vitejs/plugin-legacy` | NO ENCONTRADO | `package.json` |
| APIs requeridas | Service Worker, IndexedDB, `crypto.randomUUID` (solo en contexto seguro), `fetch`, eventos `online/offline`, `Intl.NumberFormat`/`DateTimeFormat` con zona `America/Bogota` | `db/baseLocal.ts:107`; `utilidades/formato.ts` |

Mínimos efectivos: Chrome/Edge 111+, Firefox 114+, Safari e iOS/iPadOS 16.4+. La afirmación del anteproyecto (Chrome 70+, Safari 11.3+, Android 5.0+) **no se cumple**. En iOS, la app instalada ya muestra un ícono propio (`apple-touch-icon.png`, A1).

---

## 14. Diseño

| Aspecto | Valor | Evidencia |
|---|---|---|
| Librería de estilos | Ninguna; CSS propio (`index.css` + `App.css`, 1 196 líneas) | `src/App.css` |
| Paleta | Igual que antes (`--accent #aa3bff`; en modo oscuro, `--accent #c084fc`) | `index.css:1-46` |
| Color del manifest | `theme_color #aa3bff`, igual al acento | `vite.config.ts:23` |
| Breakpoints | `max-width: 767px` (barras superior e inferior, bandeja compacta, hoja de Inventario); `min-width: 1024px` / `max-width: 1023px` (bandeja y panel de Inventario al lado o debajo); `max-width: 1024px` (tamaño de fuente) | `App.css:98`, `:841`, `:857`, `:1026`, `:1043`, `:1141`; `index.css:28` |
| Formularios | Estilo común (etiqueta encima, campos del mismo alto) y barras de filtros (E-14) | `App.css` |
| Idioma | Español; `lang="es"` en el HTML y en el manifest | `index.html:2`; `vite.config.ts:22` |
| Moneda | `formatoMoneda`: `es-CO`, COP, de 0 a 2 decimales. `12500` → «$ 12.500» | `utilidades/formato.ts:13-18`, `:39-43` |
| Fechas | `formatoFechaHora` en hora de Bogotá («21/09/2026, 10:15 a. m.»); `formatoFecha` para fechas sin hora («1/10/2026»), sin correrse de día | `formato.ts:20-28`, `:46-62` |
| Fecha por defecto del cierre | `fechaHoyBogota()` (F-5, corregido) | `componentes/PanelCierreCaja.tsx:28`; `formato.ts:65-67` |

---

## 15. Estado de los hallazgos de interfaz F-x

| ID | Hallazgo (02/10) | Estado en `49e6f17` | Commit |
|---|---|---|---|
| F-1 | El mapa de mesas no cargaba sin conexión | **Corregido** | `5f89fad` |
| F-2 | El catálogo no se puede editar sin conexión | **Abierto** (`api/catalogo.ts` sin cambios) | — |
| F-3 | El mensaje de D21 no se veía en el login | **Corregido** | `dca9f68` |
| F-4 | El mensaje de cierre registrado no se veía | **Corregido** | `3072214` |
| F-5 | Fecha por defecto del cierre en UTC | **Corregido** | `3072214` |
| F-6 | Abono ANULADO sin etiqueta | **Corregido** | `1cf8502` |
| F-7 / F-17 | Montos y fechas sin formato | **Corregido** | `b31ccc0` |
| F-8 | El «Cerrar sesión» de la mesa se llamaba igual que salir de la app | **Corregido** | `d8bc4bb`, `7326a5a` |
| F-9 | El cliente no enviaba `precio_unitario` en la cola | **Corregido** | `20907da` |
| F-10 | El SW respondía `/admin/` con la app | **Corregido** | `fc6c598` |
| F-11 | Novedades locales siempre como RECHAZADA | **Corregido** | `1984aec` |
| F-12 | `crypto.randomUUID` falla fuera de HTTPS | **Abierto** | — |
| F-16 | Identidad visual del template de Vite | **Corregido** | `1bf76fc`, `7326a5a` |

Hallazgos de la revisión del 03/10 (rama `correcciones-sesion-y-cierre`, informe `11`):

| ID | Hallazgo | Estado en `49e6f17` | Commit / evidencia |
|---|---|---|---|
| F-19 | D27 decidía si «hay conexión» con `navigator.onLine`. Con wifi sin internet o con el servidor dormido, podía cerrar la sesión y dejar al operador sin poder volver a entrar (§9.2 c) | **Corregido**: además exige `GET /api/health/` con 200 (máximo 5 s) | `24e7c46`; `api/salud.ts`; `componentes/Layout.tsx:53-54` |
| F-20 | La inactividad no se conservaba entre aperturas de la app | **Corregido**: `meta.ultima_actividad` y `calcularInicioInactividad` | `7688cb7`; `contexto/inactividad.ts:32-42`; `Layout.tsx:91-99` |
| F-21 | «Lo que se va a cerrar» no mostraba `por_medio_pago` ni `cantidad_movimientos` | **Corregido**: «Efectivo / Transferencia / QR (ingresos)» y «Movimientos incluidos» después de «Neto» | `f1c58f2`; `componentes/PanelCierreCaja.tsx:183-191` |
| F-22 | El campo «Fecha» de la pestaña «Cierre» parecía un filtro de la vista previa y compartía estado con el del resumen | **Corregido**: «Fecha del cierre» dentro de «Arqueo», con ayuda y estado propio | `d782bbd`; `PanelCierreCaja.tsx:34`, `:213-223` |
| F-23 | El diálogo de salida de la mesa decía «Si sales, se descartan», pero con el gesto «atrás» la bandeja se conservaba | **Corregido**: «Salir» ya no vacía la bandeja y el texto lo explica | `49e6f17`; `paginas/DetalleSesion.tsx:506-531` |

---

## Cambios respecto a la versión del 03/10 (`7326a5a`)

- §9.1: condición de cierre con `servidorDisponible()` y comprobación asíncrona (F-19); última actividad en `meta.ultima_actividad` y estado inicial al abrir la app (F-20); referencias de línea corridas; 17 pruebas (antes 5).
- §9.2 y §9.3: F-19 y F-20 marcados como corregidos; queda el retraso de temporizadores con la pantalla apagada.
- §15: F-19…F-23 corregidos, con su commit.

## Cambios respecto a la versión del 02/10

- §1: carpetas y archivos nuevos (`utilidades/`, `api/mapaMesas.ts`, `sync/vistaLocalMesas.ts`, bandeja, paneles, `inactividad.ts`, `erroresSesion.ts`); 14 páginas en vez de 16.
- §2: `/inventario/ingreso` y `/caja/cierre` ahora redirigen; Ventas funciona sin conexión; Caja tiene pestañas; el login explica el error sin red.
- §3: menú de 11 elementos para ADMIN y 6 para OPERADOR, sin «Ingreso de mercancía» ni «Cierre de caja». Barra superior de cuenta en celular (E-16) y nombre de usuario en la barra lateral.
- §4 y §5: identidad de SADIM (íconos PNG, maskable, apple-touch-icon, `lang es`, `theme_color #aa3bff`) y `navigateFallbackDenylist`.
- §6: claves `bandeja:*` en `meta`, `username` en la sesión y estado real en las novedades.
- §7: el precio del dispositivo ya viaja en la cola (D19).
- §8: D21 con su propia clase de error; lista actualizada de lo que funciona sin red.
- §9 (nuevo): D27 y su interacción con D21 y D23, con las respuestas a), b) y c) y los posibles conflictos.
- §10 a §12 (nuevos): bandeja de selección, Inventario unificado y Caja con pestañas.
- §13 y §14: formato COP y de fechas, breakpoints nuevos e idioma.
- §15: estado de F-1…F-17 y hallazgos nuevos F-19…F-23.
