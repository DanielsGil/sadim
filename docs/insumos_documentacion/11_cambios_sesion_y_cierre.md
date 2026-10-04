Actualizado al commit 49e6f17 (04/10/2026)

# 11 — Cambios de sesión y cierre (F-19 a F-23)

> Rama `correcciones-sesion-y-cierre`, creada desde `main` (`7326a5a`) el 04/10/2026. Cinco commits de código, uno por ítem, más un commit de documentación. **Sin push ni merge.** Alcance cerrado: F-19, F-20, F-21, F-22 y F-23 (`03 §9` y `§15`; `04a` P-06 y P-13). No se modificó `docs/referencia/`, no se agregaron endpoints ni dependencias, y no hay cambios de backend ni de migraciones.

---

## 1. Cambios por ítem

### F-19 — El cierre por inactividad confirma que el servidor responde (`24e7c46`)

**Antes:** la sesión se cerraba por inactividad si `navigator.onLine` era true y la cola estaba vacía. Con el wifi de la cafetería sin salida a internet, un portal cautivo o Render dormido, `navigator.onLine` sigue en true: la app cerraba la sesión y el operador no podía volver a entrar (entrar exige conexión, D23).

**Ahora:** se cierra solo si se cumplen las tres condiciones:
1. `navigator.onLine`;
2. la cola está vacía;
3. `servidorDisponible()` devuelve true.

Si alguna falla, el estado pasa a `EXPIRADA_PENDIENTE` con el aviso de siempre y se reintenta cada 15 s y al evento `online`.

- **`servidorDisponible()`** (`frontend/src/api/salud.ts`) hace `GET /api/health/` (ya existía, D25):
  - sin token (usa `fetch` directo, no el cliente HTTP);
  - con `cache: 'no-store'`;
  - con un máximo de 5 s (`AbortController`);
  - devuelve true solo con 200; nunca lanza.
- **Comprobación asíncrona sin cierres dobles** (`contexto/inactividad.ts`):
  - mientras corre una comprobación, no se lanza otra (bandera `comprobando`; `reintentarAhora()` no hace nada);
  - cada reinicio de la cuenta incrementa un contador `ciclo`; si el usuario toca la pantalla mientras se espera al servidor (hasta 5 s), el resultado se ignora y no se cierra (E-15).
- **Archivos:** `frontend/src/api/salud.ts` (nuevo), `frontend/src/contexto/inactividad.ts`, `frontend/src/componentes/Layout.tsx:53-54`, `CLAUDE.md` (D27 y conteo de Vitest).
- **Pruebas (Vitest, +6):**
  - `contexto/inactividad.test.ts`: con red y cola vacía, no cierra si el servidor no responde; cierra en el siguiente reintento cuando el servidor vuelve; la actividad durante la comprobación cancela el cierre y no se lanza una segunda comprobación.
  - `api/salud.test.ts` (nuevo): ruta `/api/health/`, `cache: 'no-store'` y sin encabezados; false con 503 o con error de red; false si no contesta en 5 s.
- **Ejemplo en la cafetería:** a las 3:30 p. m. la tablet de la barra lleva 30 minutos sin uso; el wifi está conectado pero el proveedor de internet se cayó. Antes, la app volvía al login y nadie podía entrar hasta que volviera internet. Ahora muestra «La sesión expiró por inactividad…» y el siguiente cliente se puede atender normalmente.

### F-20 — La inactividad sobrevive a cerrar y abrir la app (`7688cb7`)

**Antes:** el temporizador vivía solo en memoria. Cerrar la pestaña o la app instalada y volver a abrirla reiniciaba la cuenta, y la sesión guardada seguía valiendo (D23): en la práctica, el cierre por inactividad solo ocurría con la app abierta.

**Ahora:**
- **Se guarda** la última actividad en `meta` de Dexie, clave `ultima_actividad`, en milisegundos:
  - como máximo cada 30 s mientras hay interacción;
  - y al ocultar la página (`visibilitychange` a `hidden` y `pagehide`), con el último toque exacto.
- **Al iniciar sesión** se guarda `ultima_actividad = ahora` (`api/auth.ts:14`).
- **Al cerrar sesión** se borra: `borrarSesion()` borra `sesion` y `ultima_actividad` juntas (`db/baseLocal.ts:97`), así que también se borra cuando la sesión termina por un refresh vencido.
- **Al abrir la app con una sesión guardada** (`Layout.tsx:91-99`), la función pura `calcularInicioInactividad(ultimaActividad, ahora, limite)` (`contexto/inactividad.ts:32`) calcula el estado inicial:
  - sin valor guardado (sesión de antes de este cambio): la cuenta empieza ahora;
  - menos de 30 min: la cuenta sigue desde ese momento (p. ej., cerró la app hace 10 min → quedan 20; si quedaba menos de 1 min, aparece el aviso de inmediato);
  - 30 min o más: se aplica de inmediato la regla de F-19 (cerrar si se puede; si no, `EXPIRADA_PENDIENTE`);
  - valor en el futuro (reloj del equipo cambiado): se toma como ahora.
- `TemporizadorInactividad.iniciar(transcurridoMs)` acepta el tiempo ya transcurrido.
- **No cambia lo que se puede hacer sin conexión:** si no se puede cerrar, el usuario sigue trabajando y cualquier toque reinicia la cuenta (E-15).
- **Archivos:** `frontend/src/db/baseLocal.ts`, `frontend/src/api/auth.ts`, `frontend/src/contexto/inactividad.ts`, `frontend/src/componentes/Layout.tsx`, `CLAUDE.md` (D27 y conteo de Vitest).
- **Pruebas (Vitest, +6):** 2 del temporizador (con 10 min transcurridos cierra 20 min después de abrir, con aviso al minuto 19; con la cuenta vencida y cola pendiente pasa de inmediato a `EXPIRADA_PENDIENTE` y un toque la reinicia) y 4 de la función pura (sin valor, menos de 30 min, 30 min o más, valor en el futuro).
- **Sin cambio de schema de Dexie:** `ultima_actividad` es otra fila de `meta`, igual que `sesion` o `device_id`.

### F-21 — «Lo que se va a cerrar» muestra los totales por medio de pago (`f1c58f2`)

- Después de «Neto», con los datos de la vista previa (D28) y `formatoMoneda`, solo presentación (`componentes/PanelCierreCaja.tsx:183-191`):
  - «Efectivo (ingresos): {valor}» (`por_medio_pago.EFECTIVO`);
  - «Transferencia (ingresos): {valor}» (`por_medio_pago.TRANSFERENCIA`);
  - «QR (ingresos): {valor}» (`por_medio_pago.QR`);
  - «Movimientos incluidos: {cantidad_movimientos}».
- Sin cambios en el modelo `CierreCaja`, en el endpoint ni en el tipo `VistaPreviaCierre`, que ya traía ambos campos.
- **Archivos:** `frontend/src/componentes/PanelCierreCaja.tsx`.
- **Pruebas:** no hay entorno DOM en Vitest (`05 §2`); verificado con `npx tsc -b` y en la lista manual (§5, prueba 8).

### F-22 — La fecha del cierre ya no parece un filtro (`d782bbd`)

- **Causa:** `Caja.tsx:299` dibuja un solo `<PanelCierreCaja vista={pestana} />` para las dos pestañas, así que React conservaba el mismo estado `fecha` al pasar de «Resumen del día» a «Cierre»: la fecha elegida para filtrar el resumen se usaba como fecha contable del cierre.
- **Ahora** hay dos estados separados, `fechaResumen` y `fechaCierre`, ambos con `fechaHoyBogota()` por defecto:
  - «Resumen del día»: el campo sigue llamándose «Fecha» y filtra el resumen (`PanelCierreCaja.tsx:114`).
  - «Cierre»: ya no hay campo arriba de «Lo que se va a cerrar». Dentro de «Arqueo», antes de «Efectivo contado», está «Fecha del cierre» con el texto de ayuda «Fecha con la que queda registrado este cierre. No cambia lo que se va a cerrar.» (`PanelCierreCaja.tsx:213-223`, unido al campo con `aria-describedby`).
  - Cambiar la «Fecha del cierre» no recarga nada (la vista previa no depende de ella).
- **Mensaje de éxito:** «Cierre registrado. Diferencia final: {x}» sigue visible hasta que se cambie la «Fecha del cierre» o se registre otro cierre. Cambiar la fecha del resumen ya no lo borra.
- **Archivos:** `frontend/src/componentes/PanelCierreCaja.tsx`.
- **Pruebas:** sin prueba automatizada (sin entorno DOM); lista manual §5, prueba 8.

### F-23 — Salir de la mesa no descarta la bandeja (`49e6f17`)

- Diálogo «Productos sin agregar» (`paginas/DetalleSesion.tsx:506-531`):
  - texto: «Hay {n} producto(s) en la bandeja que todavía no se han agregado a la mesa. Quedan guardados en la bandeja hasta que los agregues o los quites.»;
  - botones: «Quedarme» / «Salir».
- «Salir» ya no llama a `vaciarBandeja()`: solo navega. El resultado es el mismo se salga desde el menú, desde «Volver al mapa de mesas» o con el gesto «atrás» (que nunca pasó por el diálogo): la bandeja queda guardada en el dispositivo para esa mesa (E-19).
- **Lo que no cambió (solo se describe):**
  - **Cobrar con productos en la bandeja:** pregunta «Hay {n} producto(s) en la bandeja que no se han agregado a la mesa. ¿Cerrar la cuenta sin ellos?» con «Volver» / «Cerrar sin agregarlos». Si se confirma y el cobro sale bien, la bandeja de esa mesa se vacía y se borra del dispositivo (`DetalleSesion.tsx:284`). Si el cobro falla, la bandeja se conserva.
  - **Cancelar la cuenta:** no pregunta por la bandeja. Tras «Sí, cancelar cuenta», si la cancelación sale bien, la bandeja se vacía (`DetalleSesion.tsx:300`).
  - **Cerrar sesión** (manual o por inactividad) borra todas las bandejas (E-19).
- **Archivos:** `frontend/src/paginas/DetalleSesion.tsx`.
- **Pruebas:** sin prueba automatizada (sin entorno DOM); lista manual §5, prueba 10.

---

## 2. Textos de interfaz (para el manual de usuario)

`{x}` = valor insertado. «—» en «Texto anterior» = el texto no existía.

| Pantalla | Texto anterior | Texto nuevo |
|---|---|---|
| Caja → Cierre, «Lo que se va a cerrar» | — | «Efectivo (ingresos): {valor}» |
| Caja → Cierre, «Lo que se va a cerrar» | — | «Transferencia (ingresos): {valor}» |
| Caja → Cierre, «Lo que se va a cerrar» | — | «QR (ingresos): {valor}» |
| Caja → Cierre, «Lo que se va a cerrar» | — | «Movimientos incluidos: {cantidad}» |
| Caja → Cierre | Campo «Fecha» arriba de «Lo que se va a cerrar» (compartido con «Resumen del día») | Se quita de ahí |
| Caja → Cierre, «Arqueo» | — | Campo «Fecha del cierre» (antes de «Efectivo contado»; por defecto, hoy en Bogotá) |
| Caja → Cierre, «Arqueo» | — | «Fecha con la que queda registrado este cierre. No cambia lo que se va a cerrar.» |
| Caja → Cierre, «Arqueo» | «Cierre registrado. Diferencia final: {x}», visible hasta cambiar la «Fecha» | Mismo texto, visible hasta cambiar la «Fecha del cierre» o registrar otro cierre |
| Caja → Resumen del día | «Fecha» (compartida con «Cierre») | «Fecha» (sin cambio de texto; ahora solo en esta pestaña y con su propio valor) |
| Cuenta de mesa, diálogo «Productos sin agregar» | «Hay {n} producto(s) en la bandeja que no se han agregado a la mesa. Si sales, se descartan.» | «Hay {n} producto(s) en la bandeja que todavía no se han agregado a la mesa. Quedan guardados en la bandeja hasta que los agregues o los quites.» |
| Cuenta de mesa, diálogo «Productos sin agregar» | Botones «Quedarme» / «Salir sin agregarlos» | «Quedarme» / «Salir» |
| Todas (avisos de inactividad, F-19/F-20) | — | Sin cambios de texto. «La sesión expiró por inactividad. No se cierra todavía…» ahora también aparece cuando hay red pero el servidor no responde, y al abrir la app después de 30 min sin uso si no se puede cerrar |

---

## 3. Cambios en `CLAUDE.md`

| Sección | Cambio |
|---|---|
| D27 | Se agregan dos ajustes al final: **F-19** (condición de cierre = `navigator.onLine` + cola vacía + `GET /api/health/` con 200 vía `api/salud.ts::servidorDisponible`, sin token, `no-store`, máximo 5 s; comprobación asíncrona sin duplicados y cancelada por actividad) y **F-20** (`meta.ultima_actividad` en ms, escrita como máximo cada 30 s y al ocultar la página; vale ahora al iniciar sesión, se borra al cerrarla; al abrir la app la cuenta sigue desde ese valor con `calcularInicioInactividad`; valor futuro = ahora). |
| Comandos del proyecto → Frontend → Pruebas | «38 pruebas en 7 archivos» → «50 pruebas en 8 archivos», con `api/salud.test.ts` (F-19) en la lista. |

No hay decisiones nuevas (D29 no se usa). F-21, F-22 y F-23 son de presentación y no cambian ninguna decisión: F-21 y F-22 caben dentro de D28 y F-23 dentro de E-19.

---

## 4. Verificación final (salida real, 04/10/2026, rama `correcciones-sesion-y-cierre` en `49e6f17`)

**Backend** (`python backend\manage.py test usuarios inventario core ventas finanzas servicios`, PostgreSQL 18 local):

```
Found 194 test(s).
System check identified no issues (0 silenced).
...
Ran 194 tests in 15.415s

OK
Destroying test database for alias 'default'...
```

**Frontend** (`cd frontend && npm test && npx tsc -b && npm run lint && npm run build`):

```
 Test Files  8 passed (8)
      Tests  50 passed (50)
   Duration  381ms

npx tsc -b                → sin errores
npm run lint (oxlint)     → código de salida 0; 12 advertencias, las mismas 12 que en main (7326a5a),
                            comparadas archivo por archivo; ninguna nueva
npm run build             → ✓ built in 998ms
PWA v1.3.0 · mode generateSW · precache 16 entries (545.55 KiB) · files generated: dist/sw.js, dist/workbox-9c191d2f.js
```

---

## 5. Lista ÚNICA de verificación manual en navegador

Reúne la lista del informe 10 §5 (B4, B3, A1, B2, A5, A2, A4) y las pruebas de F-19 a F-23. **Nada de esta lista se ha probado todavía en un navegador ni en un dispositivo real.**

### 5.0 Prerrequisitos (para todas las pruebas)

1. Backend en marcha (`python backend\manage.py runserver`) y frontend con `npm run dev` (o la versión desplegada en Render para las pruebas 3, 4 y 5).
2. Un ADMIN y un OPERADOR activos; todos los módulos activos; Efectivo, Transferencia y QR habilitados con llave Nequi.
3. Catálogo con al menos: un producto con control de stock (p. ej. «Gaseosa 400 ml», $7.500, stock 20) y uno sin control (p. ej. «Tinto»).
4. Al menos 3 mesas activas.
5. **Registrar y autorizar el equipo que trabajará sin conexión:** entrar como ADMIN, con conexión → Dispositivos → «Registrar este dispositivo» (p. ej. «Caja principal») → «Autorizar». La fila debe mostrar «(este dispositivo)» y «Autorizado offline: Sí». Sin esto, la cola nunca baja (`DISPOSITIVO_NO_AUTORIZADO`, D16) y las pruebas 1, 2 y 9 fallan por otra causa.
6. Chrome de escritorio con DevTools (F12) para las pruebas sin conexión: pestaña *Network* → lista *No throttling* → *Offline* simula el modo avión (en ese caso `navigator.onLine` es false).

### 5.1 Pruebas

**1. Mapa de mesas en modo avión (B4).**
- Datos previos: prerrequisitos; mapa de Ventas visto una vez en línea.
- Pasos:
  1. Pasar a *Offline* y recargar Ventas: el mapa aparece, con «Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.».
  2. Abrir una mesa libre, tocar 2 productos y «Agregar a la mesa (2)». Volver al mapa: la mesa sale «Ocupada» con «Total: $ …» y «provisional».
  3. Cobrar la cuenta en efectivo: la mesa vuelve a «Disponible».
  4. Volver a *No throttling*: tras sincronizar, el mapa coincide con el servidor y sin «provisional».

**2. Precio del dispositivo en una cuenta de mesa sin conexión (B3, D19).**
- Datos previos: prerrequisitos; «Gaseosa 400 ml» a $7.500; un segundo equipo o navegador (otra ventana de incógnito) con sesión ADMIN en línea.
- Pasos:
  1. En el equipo autorizado, pasar a *Offline*.
  2. Abrir una mesa libre, agregar 1 «Gaseosa 400 ml» con «Agregar a la mesa (1)». **No cobrarla:** la cuenta debe quedar abierta.
  3. En el otro navegador, en línea: Catálogo → editar «Gaseosa 400 ml» → precio $8.000 → guardar.
  4. Volver a *No throttling* en el equipo autorizado y esperar a que el indicador ya no muestre pendientes.
  5. Abrir esa mesa: en la tabla, la columna «Precio unitario» de la gaseosa debe decir **$ 7.500** (precio del dispositivo), no $ 8.000.
  6. En línea, agregar otra gaseosa a la misma mesa: esa línea entra a **$ 8.000** (precio vigente) y la columna muestra «Varios» al agruparlas.
  7. Cancelar o cobrar la cuenta al terminar.

**3. Instalar la PWA en Android (A1).**
- Datos previos: versión desplegada (HTTPS); celular Android con Chrome.
- Pasos: menú de Chrome → «Instalar app» o «Agregar a la pantalla principal». Comprobar el ícono «S» blanco sobre morado (también recortado en círculo o squircle por el lanzador) y el nombre «SADIM». Abrirla: ventana sin barra del navegador.

**4. Instalar la PWA en iOS (A1).**
- Datos previos: versión desplegada; iPhone o iPad con Safari (iOS 16.4+).
- Pasos: Safari → Compartir → «Agregar a inicio». Comprobar el ícono `apple-touch-icon` (no una captura genérica de la página) y el nombre «SADIM».

**5. `/admin/` y `/api/health/` con la PWA instalada (B2).**
- Datos previos: versión desplegada; la app abierta una vez después del despliegue (para que se active el service worker nuevo).
- Pasos: navegar a `/admin/` → debe salir el login del admin de Django, no la app. Navegar a `/api/health/` → `{"status": "ok"}`.

**6. Formatos de moneda y fecha (A2).**
- Datos previos: algunos datos en cada pantalla (venta, orden con abono y entrega estimada, movimiento de inventario, novedad, dispositivo sincronizado).
- Pasos: revisar «$ 12.500» (con separador de miles) en mesas, selector, bandeja, órdenes, catálogo, caja y cierre; fechas «dd/mm/aaaa, h:mm a. m.» en abonos, historial, pagos pendientes, novedades y dispositivos; la entrega estimada de una orden muestra el día correcto (no el anterior).

**7. Mensajes del inicio de sesión (A4).**
- Datos previos: prerrequisitos; sesión cerrada y cola vacía.
- Pasos:
  1. *Offline* → intentar entrar: «No hay conexión. El primer inicio de sesión necesita internet.».
  2. En línea con una contraseña errada: «El usuario o la contraseña no son correctos.».
  3. Con cola pendiente de otro usuario: entrar como OPERADOR, pasar a *Offline* y registrar un gasto en efectivo. Como D21 no deja cerrar sesión con cola, borrar a mano la fila `sesion` en DevTools → *Application* → *IndexedDB* → `sadim` → `meta` (*Delete selected*) y recargar. Volver a *No throttling* e intentar entrar como ADMIN: «Hay operaciones sin sincronizar de otro usuario en este dispositivo. Inicia sesión con esa cuenta primero.». Luego entrar como OPERADOR para que la cola se sincronice.

**8. Cierre de caja completo con gasto en efectivo (A5, F-21, F-22).**
- Datos previos: ADMIN en línea; un cierre recién registrado para que «Lo que se va a cerrar» empiece vacío (si no, las cifras de abajo se suman a lo que ya estaba sin cerrar); después, una venta rápida en efectivo de $20.000, una venta rápida por transferencia confirmada en «Pagos pendientes» y un gasto en efectivo de $5.000.
- Pasos:
  1. Caja → «Resumen del día»: arriba está el campo «Fecha» (hoy en Bogotá). Cambiarla a ayer: el resumen se recarga con ese día.
  2. Pasar a «Cierre»: **no** hay campo de fecha arriba de «Lo que se va a cerrar» (F-22).
  3. En «Lo que se va a cerrar», después de «Neto», comprobar «Efectivo (ingresos): $ 20.000», «Transferencia (ingresos): {valor de la venta}», «QR (ingresos): $ 0» y «Movimientos incluidos: 3» (F-21). «Efectivo esperado» = $ 15.000 (venta − gasto).
  4. En «Arqueo», el primer campo es «Fecha del cierre» con la ayuda «Fecha con la que queda registrado este cierre. No cambia lo que se va a cerrar.» y vale hoy, aunque el resumen se haya dejado en ayer (estados separados). Cambiarla: «Lo que se va a cerrar» no cambia.
  5. Dejar la fecha de hoy; escribir «Efectivo contado» = 15000: «Diferencia estimada: $ 0».
  6. «Registrar cierre»: «Cierre registrado. Diferencia final: $ 0»; el mensaje sigue visible tras recargar los datos y el cierre aparece en «Cierres anteriores».
  7. Ir a «Resumen del día» y volver a «Cierre»: el mensaje sigue ahí. Cambiar la «Fecha del cierre»: el mensaje desaparece.
  8. Probar una diferencia distinta de cero (con otra fecha y nuevos movimientos): exige observaciones.
  9. Intentar otro cierre con la misma fecha: «Ya existe un cierre de caja registrado para esta fecha.».
  10. Después de las 19:00 (hora de Bogotá), recargar: «Fecha del cierre» y «Fecha» del resumen deben ser hoy, no mañana.

**9. Cierre por inactividad cuando hay red pero el servidor no responde (F-19).**
- Datos previos: prerrequisitos; OPERADOR con sesión iniciada en Chrome de escritorio; cola vacía.
- Cómo no esperar 30 minutos sin tocar el código — se adelanta `ultima_actividad` desde una página del mismo origen que no carga la app (así ningún `pagehide` de la app la sobrescribe):
  1. Cerrar la pestaña de la app.
  2. Abrir en una pestaña nueva `{origen}/api/health/` (p. ej. `http://localhost:5173/api/health/`) y abrir DevTools en esa pestaña.
  3. En la consola ejecutar:
     ```js
     const r = indexedDB.open('sadim'); r.onsuccess = () => { const tx = r.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ clave: 'ultima_actividad', valor: Date.now() - 31 * 60 * 1000 }); tx.oncomplete = () => console.log('listo') }
     ```
- Cómo simular «hay red pero el servidor no responde» (con *Offline* no sirve, porque ahí `navigator.onLine` es false):
  - DevTools → menú ⋮ → *More tools* → *Network request blocking* → activar *Enable network request blocking* → agregar el patrón `*/api/*`. Las peticiones a la API fallan y `navigator.onLine` sigue en true, como con un wifi sin internet.
  - Alternativa sin DevTools: detener el backend (Ctrl+C en `runserver`) con `npm run dev` corriendo.
- Pasos:
  1. Con el bloqueo activo, en la misma pestaña navegar a `/` **sin tocar la página** (dejar el mouse sobre DevTools: mover el mouse sobre la app cuenta como actividad): aparece «La sesión expiró por inactividad. No se cierra todavía…» y la sesión sigue abierta (antes de F-19 habría vuelto al login).
  2. Esperar 1 minuto sin tocar: sigue igual (reintentos cada 15 s, todos fallan).
  3. Desactivar el bloqueo (o volver a arrancar el backend) sin tocar la página: en máximo 15 s la app vuelve a `/login`.
  4. Repetir los pasos de preparación; con el bloqueo activo y el aviso en pantalla, mover el mouse: el aviso desaparece (la cuenta vuelve a 30 min, E-15) y, al quitar el bloqueo, la sesión **no** se cierra.

**10. Salir de la mesa con productos en la bandeja (F-23, E-19).**
- Datos previos: OPERADOR en línea; una mesa con cuenta abierta.
- Pasos:
  1. Entrar a la mesa y tocar 2 productos (sin «Agregar a la mesa»).
  2. «Volver al mapa de mesas»: aparece «Productos sin agregar» con «Hay 2 producto(s) en la bandeja que todavía no se han agregado a la mesa. Quedan guardados en la bandeja hasta que los agregues o los quites.» y los botones «Quedarme» / «Salir».
  3. «Quedarme»: el diálogo se cierra y la bandeja sigue igual.
  4. «Volver al mapa de mesas» → «Salir»: vuelve al mapa. Entrar otra vez a la mesa: los 2 productos siguen en la bandeja.
  5. Repetir saliendo por un enlace del menú (p. ej. «Inicio») y por el gesto o botón «atrás» del navegador: en los tres casos la bandeja se conserva.
  6. Con productos en la bandeja, «Cobrar y cerrar cuenta»: pregunta «¿Cerrar la cuenta sin ellos?» con «Volver» / «Cerrar sin agregarlos» (sin cambios). Al confirmar y cobrar, la bandeja de esa mesa queda vacía.

**11. La inactividad sobrevive a cerrar y abrir la app (F-20).**
- Datos previos: prerrequisitos; OPERADOR con sesión iniciada; cola vacía; servidor en línea.
- Pasos:
  1. **Menos de 30 min:** usar la app, cerrar la pestaña y abrirla de nuevo enseguida: entra directo, sin aviso.
  2. **30 min o más, con conexión:** hacer la preparación de la prueba 9 (pasos 1 a 3), **sin** bloqueo, y navegar a `/`: la app vuelve a `/login` de inmediato.
  3. **30 min o más, sin poder cerrar:** repetir con *Offline* (o con un gasto en la cola): aparece «La sesión expiró por inactividad…» y se puede seguir trabajando; cualquier toque reinicia la cuenta.
  4. **Reloj cambiado:** en la preparación usar `Date.now() + 60 * 60 * 1000` (una hora en el futuro): al abrir la app no se cierra ni avisa (se toma como ahora).
  5. **Al iniciar y cerrar sesión:** en DevTools → *Application* → *IndexedDB* → `sadim` → `meta`, comprobar que `ultima_actividad` aparece al iniciar sesión y desaparece al cerrarla.
- La prueba 2 de este punto también cubre la app instalada: cerrarla desde el selector de apps tiene el mismo efecto que cerrar la pestaña.

**12. Aviso de inactividad sin trucos (D27, para la captura C-42).**
- Datos previos: OPERADOR con sesión; una pestaña abierta 29 minutos sin tocar (o la preparación de la prueba 9 con `Date.now() - 29.5 * 60 * 1000`).
- Pasos: comprobar «Por inactividad, la sesión se cerrará en 60 segundos. Toca la pantalla para seguir trabajando.»; tocar la pantalla: desaparece.

---

## 6. Problemas vistos y NO corregidos (fuera de alcance)

1. **El aviso `EXPIRADA_PENDIENTE` no menciona el servidor.** Dice «…porque no hay conexión o quedan operaciones sin sincronizar.»; con F-19 también aparece cuando hay red pero el servidor no responde. El texto no se cambió porque la regla 4 del pedido fijaba los textos; para el usuario, «no hay conexión» sigue siendo una descripción razonable.
2. **«Recargar» la cuenta de mesa con bandeja sigue mostrando el aviso del navegador** (`beforeunload`, `DetalleSesion.tsx:142`), aunque la bandeja ya no se pierde al recargar (E-19). Después de F-23 ese aviso sobra.
3. **Mesa abierta por otro equipo (`MESA_OCUPADA`) vacía la bandeja** (`DetalleSesion.tsx:205`) antes de volver al mapa. Es coherente (la cuenta ya no es de este equipo), pero es el único camino de salida que sigue descartando la bandeja sin preguntar.
4. **Celular con la pantalla apagada:** F-20 recalcula la cuenta solo al abrir la app, no al volver a mostrarla. Si el navegador congela los temporizadores con la pestaña oculta, el cierre puede llegar tarde hasta la siguiente interacción o reapertura (inferido, `03 §9.2`).
5. **Dos pestañas abiertas:** cada una tiene su propio temporizador y ambas escriben `ultima_actividad`; la que cierra la sesión borra la clave y la otra queda con una sesión que ya no existe (igual que antes, `03 §9.2 c)` punto 3).
6. **Un cierre abrupto sin `pagehide`** (el sistema mata el navegador) puede perder hasta 30 s de la última actividad guardada. Es el margen aceptado al escribir como máximo cada 30 s.
7. **Lint:** siguen las 12 advertencias de antes (`react(set-state-in-effect)` y una `only-export-components`). F-22 introdujo y corrigió en el mismo commit una advertencia `exhaustive-deps`; no quedó ninguna nueva.

---

## 7. Commits de la rama

| Commit | Mensaje |
|---|---|
| `24e7c46` | fix(sesion): el cierre por inactividad confirma que el servidor responde [F-19][D27][CU-17] |
| `7688cb7` | fix(sesion): la inactividad sobrevive a cerrar y abrir la app [F-20][D27][CU-17] |
| `f1c58f2` | fix(finanzas): «Lo que se va a cerrar» muestra los ingresos por medio de pago [F-21][D28][CU-15] |
| `d782bbd` | fix(finanzas): la fecha del cierre ya no parece un filtro [F-22][CU-15] |
| `49e6f17` | fix(ventas): salir de la mesa no descarta la bandeja [F-23][E-19][CU-03] |
| (siguiente) | docs: inventario verificado para la documentación final |
