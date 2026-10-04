Actualizado al commit 49e6f17 (04/10/2026)

# 04a — Pantallas para el Manual de usuario

> Textos copiados EXACTOS del código (`frontend/src/...`). Entre comillas latinas «…» va el texto literal; `{x}` indica un valor que se inserta. Los mensajes de error que vienen del servidor se muestran tal cual (catálogo en `02b_backend.md §10`).
> Los montos se ven en pesos colombianos (p. ej. «$ 12.500») y las fechas en hora de Bogotá (p. ej. «21/09/2026, 10:15 a. m.»; fechas sin hora: «1/10/2026»), `utilidades/formato.ts`.
> «Offline» según lectura de código (no probado en navegador). Hallazgos vigentes al final.
>
> **Elementos comunes a varias pantallas:**
> - Carga inicial de la app: «Cargando…» (`componentes/RutaProtegida.tsx`).
> - Aviso sin conexión: «Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.» (`componentes/AvisoLocal.tsx:6`).
> - Etiqueta junto a valores calculados en el dispositivo: «provisional» (al pasar el cursor: «Se recalcula en el servidor al sincronizar», `AvisoLocal.tsx:15-16`).
> - Indicador de conexión: «En línea» / «Sin conexión» y «{n} operación pendiente de sincronizar» / «{n} operaciones pendientes de sincronizar».
> - Error de stock: «No hay existencias suficientes: {producto} (disponible: {x}, pedido: {y}).» (`api/errorApi.ts:25-38`).
> - Contador de cantidad: «−» / número / «+» (mínimo 1, solo enteros; `componentes/ContadorCantidad.tsx`).
> - Selector de productos (venta rápida y cuenta de mesa): buscador «Buscar producto por nombre…», botones de categoría (solo las que tienen productos activos, cada una con su color) y tarjetas con nombre, precio, «Stock: {n}» si el producto controla existencias y «+{n}» con lo que ya está en la bandeja. Mensajes: «No hay categorías con productos activos.», «Ningún producto coincide con la búsqueda.», «{categoría} no tiene productos activos.», «Elige una categoría o busca un producto por nombre.» (`componentes/SelectorProductos.tsx`).
> - **Bandeja de selección** (venta rápida y cuenta de mesa, `componentes/BandejaSeleccion.tsx`): título «Selección»; vacía: «Toca un producto para agregarlo aquí.»; cada línea con nombre, precio, contador y «Quitar»; «Total estimado: {total} (lo confirma el servidor)»; botón «{acción} ({unidades})». En celular aparece como barra compacta «{n} producto(s) · {total}» (más « · {n} con error» si alguna línea falló) con un botón corto; al tocarla se abre como hoja, con «Ocultar».
> - **Avisos de inactividad (D27)**, arriba del contenido (`componentes/Layout.tsx:197-209`): «Por inactividad, la sesión se cerrará en 60 segundos. Toca la pantalla para seguir trabajando.» y «La sesión expiró por inactividad. No se cierra todavía porque no hay conexión o quedan operaciones sin sincronizar. Si sigues trabajando, la sesión continúa; si no, se cerrará apenas haya conexión y todo quede sincronizado.»

---

## P-01 Inicio de sesión *(cambió: A1, A4)*

- **Ruta:** `/login` · **Roles:** todos · **Módulo:** ninguno · **Offline:** la pantalla abre, pero ingresar requiere conexión.
- **Propósito:** autenticarse con usuario y contraseña.
- **Elementos:** título «SADIM»; subtítulo «Inicia sesión para continuar»; campo «Usuario» (texto, obligatorio); campo «Contraseña» (contraseña, obligatorio); botón «Ingresar» (mientras envía: «Ingresando…»). No hay enlace de registro ni de «olvidé mi contraseña». La pestaña del navegador dice «SADIM».
- **Pasos:** escribir usuario y contraseña → «Ingresar» → si es correcto, entra a Inicio.
- **Mensajes** (`paginas/Login.tsx:14-21`):
  - Datos errados o usuario inactivo (del servidor): «El usuario o la contraseña no son correctos.»
  - Sin conexión: «No hay conexión. El primer inicio de sesión necesita internet.»
  - Hay operaciones pendientes de otro usuario en el equipo (D21): «Hay operaciones sin sincronizar de otro usuario en este dispositivo. Inicia sesión con esa cuenta primero.»
  - Cualquier otro fallo: «No se pudo iniciar sesión.»
- **Endpoints:** `POST /api/auth/login/`, luego `GET /api/configuracion/modulos/`. **CU-17.**

## P-02 Estructura general (menú, cuenta y cierre de sesión) *(cambió: E-13, E-16, E-18, D27, F-19, F-20)*

- **Escritorio:** barra lateral con «SADIM», lista de secciones (`03 §3`) y, abajo, indicador de conexión, nombre de usuario, rol («Administrador» / «Operador») y botón «Cerrar sesión».
- **Celular:**
  - **Barra superior** con «SADIM» y el botón «👤 {usuario}». Al tocarlo se despliega el usuario, el rol, el indicador de conexión y «Cerrar sesión».
  - **Barra inferior** con hasta 4 secciones + «Más» (hoja con el resto, el indicador, el rol y otro «Cerrar sesión»). ADMIN: Inicio · Ventas · Mesas · Stock · Más. OPERADOR: Inicio · Ventas · Stock · Órdenes · Más.
- **Cerrar sesión:** botón «Cerrar sesión» → vuelve a `/login`. Si hay operaciones sin enviar: «Hay {n} operación(es) sin sincronizar. Conéctate para sincronizar antes de cerrar sesión.»; otro fallo: «No se pudo cerrar sesión.».
- **Cierre por inactividad (D27):**
  - Tras 29 minutos sin tocar la pantalla aparece «Por inactividad, la sesión se cerrará en 60 segundos. Toca la pantalla para seguir trabajando.».
  - Al minuto 30, la app vuelve a `/login` solo si se cumplen las tres condiciones: hay red, no hay operaciones pendientes y el servidor responde (F-19; con el wifi sin internet o el servidor dormido, no se cierra).
  - Si no se puede cerrar, muestra «La sesión expiró por inactividad. No se cierra todavía porque no hay conexión o quedan operaciones sin sincronizar. Si sigues trabajando, la sesión continúa; si no, se cerrará apenas haya conexión y todo quede sincronizado.» y deja seguir trabajando; reintenta cada 15 s.
  - Cualquier toque reinicia la cuenta.
  - La cuenta sigue aunque se cierre la app (F-20): si se cierra a las 3:00 p. m. y se abre a las 3:10, quedan 20 minutos; si se abre a las 3:45, se aplica de inmediato la regla anterior (vuelve al login o muestra el aviso de sesión expirada).
- **Endpoints:** `GET /api/health/` (solo para comprobar que el servidor responde antes de cerrar por inactividad, F-19). Cerrar sesión solo borra la sesión local; nunca la cola. **CU-17.**

## P-03 Inicio *(cambió: accesos rápidos)*

- **Ruta:** `/` · **Roles:** ADMIN, OPERADOR · **Offline:** sí.
- **Propósito:** saludo y accesos rápidos a las secciones disponibles.
- **Elementos:** título «Hola, Administrador» u «Hola, Operador»; indicador de conexión; subtítulo «Accesos rápidos»; una tarjeta por sección del menú (ícono + etiqueta, sin «Inicio»). Con todos los módulos activos: ADMIN 10 tarjetas (Ventas, Mesas, Inventario, Órdenes, Caja, Novedades, Catálogo, Usuarios, Configuración, Dispositivos); OPERADOR 5 (Ventas, Inventario, Órdenes, Caja, Novedades). Ya no hay tarjetas «Ingreso de mercancía» ni «Cierre de caja».
- **No tiene** (a diferencia del wireframe 2): tarjetas KPI del día, mesas ocupadas con tiempo/total, novedades pendientes, resumen financiero.
- **Endpoints:** ninguno propio. **CU:** entrada a CU-01, CU-02, CU-06, CU-11.

## P-04 Ventas — mapa de mesas *(cambió: B4, A2)*

- **Ruta:** `/ventas` · **Roles:** ADMIN, OPERADOR · **Módulo:** Ventas · **Offline:** sí (copia local).
- **Propósito:** ver las mesas activas y su estado, entrar a una mesa o abrir la venta rápida.
- **Elementos:** título «Ventas»; botón «Venta rápida»; aviso sin conexión; cuadrícula de tarjetas «Mesa {número}» con «Disponible» u «Ocupada» y, si tiene cuenta abierta, «Total: {total}» (+ «provisional» si el mapa sale de la copia local).
- **Pasos:** tocar una mesa → abre su cuenta (no crea nada en el servidor hasta agregar el primer producto, D26). Tocar «Venta rápida» → abre el panel P-05.
- **Mensajes:** «Cargando mesas…»; vacío «No hay mesas activas todavía.»; error en línea «No se pudo cargar el mapa de mesas.» (o el del servidor). Sin conexión ya no da error: muestra la copia local.
- **Endpoints:** `GET /api/mesas/?activa=true`, `GET /api/ventas/?estado=ABIERTA` (o copia local: mesas del catálogo local + ventas abiertas guardadas + operaciones en cola). **CU-02, CU-19.**

## P-05 Venta rápida (panel dentro de Ventas) *(cambió: E-12, E-17, E-19, A2)*

- **Ruta:** `/ventas` (panel) · **Roles:** ADMIN, OPERADOR · **Módulo:** Ventas · **Offline:** sí (se encola).
- **Propósito:** registrar una venta de mostrador de uno o varios productos, ya cobrada.
- **Elementos:** título «Venta rápida»; botón «Cancelar»; selector de productos; bandeja «Selección» (el carrito) con «Medio de pago» («Selecciona uno», «Efectivo», «Transferencia», «QR» — solo los habilitados); con Transferencia/QR y llave configurada: «Nequi {titular}: {llave} — el cobro queda pendiente de verificación, nunca como pagado.»; botón «Cobrar ({n})» (mientras envía: «Registrando…»). En celular, la barra compacta dice «Cobrar» y solo abre la hoja (hay que elegir el medio de pago antes).
- **Pasos:** elegir categoría o buscar → tocar cada producto tantas veces como unidades (la tarjeta muestra «+{n}») → ajustar con «−»/«+» o «Quitar» en la bandeja → elegir medio de pago → «Cobrar». Al registrarse, el panel se cierra y el mapa se recarga (no hay comprobante ni mensaje de éxito).
- **Carrito guardado:** si se sale sin cobrar (o se cierra la app), al volver a abrir la venta rápida el carrito sigue ahí. «Cancelar» con productos pregunta: «Hay {n} producto(s) en el carrito. ¿Descartar la venta?» con «Seguir vendiendo» / «Descartar».
- **Validaciones/mensajes:** «Agrega al menos un producto.»; «Selecciona un medio de pago.»; error de stock; «El medio de pago {X} no está habilitado en esta instalación.»; «El producto "{nombre}" está inactivo.»; genérico «No se pudo registrar la venta.».
- **Endpoint:** `POST /api/ventas/` (tipo RAPIDA) o cola `ventas`/CREATE (con el precio del dispositivo, D19). **CU-01.**

## P-06 Cuenta de mesa (detalle de sesión dinámica) *(cambió: E-12, E-17, E-19, A3, 7326a5a, A2, F-23)*

- **Ruta:** `/ventas/mesas/:mesaId` · **Roles:** ADMIN, OPERADOR · **Módulo:** Ventas · **Offline:** sí (copia local + cola).
- **Propósito:** llevar la cuenta abierta de una mesa: agregar o quitar productos, cobrar o cancelar.
- **Elementos:**
  - Título «Mesa {número}» (o «Cuenta»), botón «Volver al mapa de mesas» y aviso sin conexión.
  - **Con cuenta abierta:** tabla con columnas «Producto», «Cantidad», «Precio unitario» («Varios» si el mismo producto entró a precios distintos), «Subtotal» y «Acciones» (botón «Quitar», o «Quitar últimos {n}» si el producto se agregó en varias tandas); fila vacía «Todavía no se han agregado productos.»; «Total: {total}».
  - **Sin cuenta:** «Esta mesa no tiene una cuenta abierta. Agrega el primer producto para abrirla.»
  - Sección «Agregar producto»: selector + bandeja con botón «Agregar a la mesa ({n})» («Agregando…»; en la barra compacta de celular, «Agregar»). Si no hay conexión y la cantidad supera el stock local: «Supera el stock que se ve en este dispositivo; puede generar un conflicto al sincronizar.» (no bloquea).
  - Sección «Cobrar cuenta» (solo con cuenta): «Medio de pago», nota Nequi, botón «Cobrar y cerrar cuenta» («Cobrando…»).
  - Botón «Cancelar cuenta».
- **Pasos:**
  - Abrir cuenta: tocar los productos → «Agregar a la mesa». Primero se abre la cuenta y luego se envía cada producto, en orden. Si el primero falla, la cuenta recién abierta se cancela sola.
  - Agregar más: repetir. Quitar: «Quitar» en la fila.
  - Cobrar: elegir medio de pago → «Cobrar y cerrar cuenta» → vuelve al mapa; la mesa queda Disponible. Si quedan productos en la bandeja sin agregar: «Hay {n} producto(s) en la bandeja que no se han agregado a la mesa. ¿Cerrar la cuenta sin ellos?» con «Volver» / «Cerrar sin agregarlos». Al cobrar con éxito, la bandeja de esa mesa se vacía.
  - Cancelar: «Cancelar cuenta» → «¿Seguro que quieres cancelar esta cuenta? No se cobrará nada ni se descontará inventario.» con «No» / «Sí, cancelar cuenta». Al cancelar con éxito, la bandeja de esa mesa se vacía.
  - Salir con productos en la bandeja (enlace del menú o «Volver al mapa de mesas»): diálogo «Productos sin agregar» — «Hay {n} producto(s) en la bandeja que todavía no se han agregado a la mesa. Quedan guardados en la bandeja hasta que los agregues o los quites.» con «Quedarme» / «Salir». «Salir» **no** vacía la bandeja: al volver a la mesa, los productos siguen ahí. Con el gesto «atrás» no aparece el diálogo y el resultado es el mismo (F-23).
- **Mensajes:** «Cargando cuenta…»; «No se pudo cargar la cuenta.»; «No se pudo abrir la cuenta.»; «No se pudo agregar el producto.»; «Algunos productos no se agregaron; quedaron en la bandeja con su error.»; «No se pudo actualizar la cuenta.»; «No se pudo quitar el producto.»; «Selecciona un medio de pago para cobrar.»; «No se pudo cobrar la cuenta.»; «No se pudo cancelar la cuenta.»; mesa abierta por otro equipo → vacía la bandeja y vuelve al mapa; stock insuficiente al agregar (en línea) o al cobrar.
- **Endpoints:** `GET /api/ventas/?mesa=&estado=ABIERTA`, `GET /api/categorias/`, `GET /api/productos/`, `GET /api/configuracion/pagos/`, `GET /api/mesas/?activa=true`; `POST /api/ventas/` (SESION_DINAMICA), `POST /api/ventas/{id}/detalles/` (uno por producto), `DELETE /api/ventas/{id}/detalles/{detalle_id}/`, `PATCH /api/ventas/{id}/cerrar/`, `PATCH /api/ventas/{id}/cancelar/`. **CU-02, CU-03, CU-04.**

## P-07 Órdenes de trabajo (listado) *(cambió: A2, E-14)*

- **Ruta:** `/ordenes` · **Roles:** ADMIN, OPERADOR · **Módulo:** Servicios · **Offline:** sí.
- **Elementos:** título «Órdenes de trabajo»; botón «Nuevo pedido»; barra de filtro «Filtrar por estado» («Todos», «Recibido», «En proceso», «Listo», «Entregado»); tabla «Cliente», «Entrega estimada» (p. ej. «1/10/2026»), «Estado», «Saldo pendiente» (en pesos, + «provisional»); cada fila abre el detalle.
- **Mensajes:** «Cargando órdenes…»; vacío «Todavía no hay órdenes registradas.»; error «No se pudieron cargar las órdenes.».
- **Endpoint:** `GET /api/ordenes-trabajo/?estado=`. **CU-06, CU-07.**

## P-08 Nuevo pedido (panel) *(sin cambios de texto)*

- **Ruta:** `/ordenes` (panel) · **Offline:** sí (se encola).
- **Elementos:** título «Nuevo pedido»; «Cliente» (obligatorio); «Teléfono (opcional)»; «Descripción del encargo» (obligatorio); «Fecha de entrega estimada» (obligatorio); «Costo total acordado» (número ≥ 0, obligatorio); «Cancelar» y «Guardar» («Guardando…»). Errores por campo debajo de cada casilla.
- **Pasos:** llenar → «Guardar» → la orden aparece en estado Recibido con saldo = costo total. El abono inicial (CU-06) se registra después en el detalle.
- **Mensajes:** «No se pudo registrar el pedido.» o el del servidor.
- **Endpoint:** `POST /api/ordenes-trabajo/`. **CU-06.**

## P-09 Detalle de orden *(cambió: A2, A6)*

- **Ruta:** `/ordenes/:ordenId` · **Roles:** ADMIN, OPERADOR (costos solo ADMIN) · **Módulo:** Servicios · **Offline:** sí si la orden está en la copia local.
- **Elementos:**
  - «Orden de {cliente}» y «Volver a órdenes».
  - Datos: «Cliente: …», «Teléfono: …» (si hay), «Encargo: …», «Entrega estimada: {d/m/aaaa}», «Estado: …», «Costo total: $ …», «Saldo pendiente: $ …» (+ «provisional»).
  - Botón «Avanzar a {En proceso|Listo|Entregado}» (no aparece si ya está Entregado).
  - «Abonos»: tabla «Valor» ($), «Medio de pago», «Estado» («Confirmado» / «Pendiente de verificación» / **«Anulado»**), «Fecha» (fecha y hora); vacío «Todavía no hay abonos.»; «Valor del abono»; «Medio de pago»; aviso «El valor supera el saldo pendiente que se ve aquí; puede generar un conflicto al sincronizar.» (solo provisional); nota «Nequi {titular}: {llave} — el abono queda pendiente de verificación, nunca como pagado.»; «Registrar abono».
  - «Consumos»: tabla «Producto», «Cantidad», «Estado» («Aplicado» / «Pendiente»); vacío «Todavía no hay consumos.»; si no está entregada: «Producto», «Cantidad», «Registrar consumo».
  - «Costos operativos» (solo ADMIN): «Utilidad neta: $ …» (+ «provisional»); tabla «Concepto», «Valor» ($); vacío «Todavía no hay costos registrados.»; si no está entregada: «Concepto», «Valor», «Registrar costo».
- **Pasos y mensajes:** sin cambios respecto a la versión del 02/10 (diálogo «Pasar a ENTREGADO descuenta el inventario de los consumos pendientes. ¿Continuar?» con «No» / «Sí, entregar»; «Cargando orden…»; «Esta orden no existe.»; «No se pudo cargar la orden.»; «No se pudo avanzar el estado de la orden.»; «No se pudo registrar el abono.»; «No se pudo registrar el consumo.»; «No se pudo registrar el costo.»). Si falta valor o medio de pago, «Registrar abono» no hace nada (sin mensaje).
- **Endpoints:** `GET /api/ordenes-trabajo/{id}/`, `GET …/consumos/`, `GET …/costos/` (ADMIN), `PATCH …/estado/`, `POST …/abonos/`, `POST …/consumos/`, `POST …/costos/`. **CU-07, CU-08, CU-09, CU-10.**

## P-10 Inventario (existencias, historial e ingreso de mercancía) *(cambió: E-13, A7, A2)*

- **Ruta:** `/inventario` · **Roles:** ADMIN, OPERADOR (Merma y Ajuste solo ADMIN) · **Módulo:** Inventario · **Offline:** sí (provisional; los movimientos se encolan).
- **Distribución:** en escritorio, existencias a la izquierda y panel «Registrar movimiento» a la derecha; en celular, la tabla ocupa la pantalla y el botón «Registrar movimiento» abre el panel como hoja (con «Cerrar»).
- **Existencias:** título «Inventario»; botón «Registrar movimiento» (celular); filtros «Categoría» («Todas» + categorías) y «Tipo» («Todos», «Insumo de producción», «Reventa directa»); tabla «Producto», «Stock actual» (+ «provisional»), «Stock mínimo», insignia «Stock mínimo» cuando está en o bajo el mínimo; productos sin control de existencias: «—».
- **Historial:** al tocar una fila, «Historial — {producto}» con «Cerrar» y tabla «Tipo», «Cantidad», «Fecha», «Motivo» («—» si no hay); vacío «Sin movimientos registrados.». Tipos: «Ingreso de mercancía», «Salida por venta», «Salida por orden de trabajo», «Merma», «Ajuste manual (suma)», «Ajuste manual (resta)». Tocar una fila también precarga ese producto en el panel.
- **Panel «Registrar movimiento»** (`componentes/PanelMovimientoInventario.tsx`):
  - Pestañas (solo ADMIN): «Ingreso», «Merma», «Ajuste». El OPERADOR ve solo el formulario de ingreso, sin pestañas.
  - «Producto» (lista «{nombre} (stock actual: {n})», solo activos que controlan existencias); «Sentido» (solo Ajuste: «Suma (sobraban unidades)», «Resta (faltaban unidades)»); «Cantidad» (contador); «Motivo (opcional)» en Ingreso (ayuda «Compra de mercancía…») o «Motivo» obligatorio en Merma y Ajuste.
  - Botón «Registrar ingreso» / «Registrar merma» / «Registrar ajuste» («Registrando…»).
- **Mensajes:** «Cargando existencias…»; «No hay productos que coincidan con el filtro.»; «No se pudo cargar el stock.»; éxito «Ingreso registrado: +{cantidad} unidades.», «Merma registrada.», «Ajuste registrado.»; «Selecciona un producto.»; «No se pudo registrar el movimiento.»; sin productos: «No hay productos con control de existencias (controla_stock) en el catálogo.»; del servidor «La merma dejaría el stock por debajo de cero.» / «El ajuste dejaría el stock por debajo de cero.».
- **Endpoints:** `GET /api/categorias/`, `GET /api/productos/`, `GET /api/inventario/stock/?categoria=&tipo=`, `GET /api/inventario/movimientos/?producto=`, `POST /api/inventario/movimientos/` (ENTRADA, MERMA, AJUSTE_MANUAL). **CU-11, CU-12, CU-13.**

## P-11 Ingreso de mercancía — *integrado en P-10*

La pantalla propia (`/inventario/ingreso`, `paginas/IngresoMercancia.tsx`) se eliminó en E-13. La URL vieja redirige a Inventario (`App.tsx:31-32`) y el ingreso se hace en la pestaña «Ingreso» del panel «Registrar movimiento» (P-10). Se conserva el ID para no renumerar las capturas.

## P-12 Caja — pestañas «Gastos» y «Pagos pendientes» *(cambió: E-18, A2)*

- **Ruta:** `/caja` (o `/caja?pestana=gastos|pendientes`) · **Roles:** ADMIN, OPERADOR (anular solo ADMIN) · **Módulo:** Finanzas · **Offline:** gasto sí; confirmar/anular no.
- **Elementos comunes:** título «Caja»; aviso sin conexión; pestañas «Gastos», «Pagos pendientes» y, solo ADMIN, «Resumen del día» y «Cierre» (P-13).
- **Pestaña «Gastos»:** sección «Registrar gasto»: «Medio de pago» (obligatorio), «Valor» (número ≥ 0,01, obligatorio), «Concepto» (obligatorio, ayuda «Compra de bolsas…»), botón «Registrar gasto» («Registrando…»).
- **Pestaña «Pagos pendientes»:** sección «Pagos pendientes de verificación»: tabla «Tipo» («Venta», «Abono», «Gasto»), «Medio de pago», «Valor» ($), «Fecha» (fecha y hora) y acciones: «Confirmar» (o «Requiere conexión» / «Pendiente de sincronizar»); solo ADMIN: casilla «Motivo de anulación» y botón «Anular» (o «Requiere conexión»).
- **Pasos:** gasto: medio + valor + concepto → «Registrar gasto». Confirmar: verificar en la app Nequi que llegó el dinero → «Confirmar» (sin diálogo). Anular (ADMIN): escribir motivo → «Anular» (sin diálogo).
- **Mensajes:** «Gasto registrado.» / «Gasto registrado, pendiente de verificación.»; «No se pudo registrar el gasto.»; «Cargando pagos pendientes…»; vacío «No hay pagos pendientes de verificación.»; «No se pudieron cargar los pagos pendientes.»; «No se pudo confirmar el pago.»; «No se pudo anular el pago.».
- **Endpoints:** `GET /api/configuracion/pagos/`, `POST /api/movimientos-caja/`, `GET /api/movimientos-caja/pendientes/`, `PATCH …/{id}/confirmar/`, `PATCH …/{id}/anular/`. **CU-14; confirmación HU-050 (CU-01/04/08); anulación D15.**

## P-13 Caja — pestañas «Resumen del día» y «Cierre» (solo ADMIN) *(cambió: E-18, A5/D28, A2, F-21, F-22)*

- **Ruta:** `/caja?pestana=resumen` y `/caja?pestana=cierre` (la vieja `/caja/cierre` redirige a la segunda) · **Roles:** ADMIN · **Módulo:** Finanzas · **Offline:** no; sin conexión cada sección muestra «Requiere conexión.».
- **Pestaña «Resumen del día»** (lo ocurrido en la fecha elegida, confirmado o pendiente):
  - Campo «Fecha» (por defecto, hoy en Bogotá): filtra el resumen. Es independiente de la «Fecha del cierre» de la otra pestaña (F-22).
  - Sección «Resumen del día»: «Ingresos por ventas: {valor}», «Ingresos por abonos: {valor}», «Gastos: {valor}», «Neto: {valor}», «Efectivo (ingresos): {valor}», «Transferencia (ingresos): {valor}», «QR (ingresos): {valor}», «Pendiente de verificación (no entra al cierre): {valor}».
  - Alerta: «Hay {n} cobro(s) pendiente(s) de verificación — quedan fuera de este cierre hasta confirmarse.»
  - Mensajes: «Cargando resumen del día…»; «No se pudo cargar el resumen del día.».
- **Pestaña «Cierre»:**
  - Sin campo de fecha arriba: la sección «Lo que se va a cerrar» no depende de ninguna fecha (F-22).
  - Sección «Lo que se va a cerrar» (vista previa del servidor, D28): «Período: desde {fecha y hora} hasta ahora», «Ingresos por ventas: {valor}», «Ingresos por abonos: {valor}», «Gastos: {valor}», «Neto: {valor}», «Efectivo (ingresos): {valor}», «Transferencia (ingresos): {valor}», «QR (ingresos): {valor}», «Movimientos incluidos: {cantidad}» (F-21), «Efectivo esperado: {valor}» y la nota «El cierre incluye todos los movimientos confirmados que aún no se han cerrado, aunque sean de días anteriores.». Mensajes: «Cargando lo que se va a cerrar…»; «No se pudo cargar lo que se va a cerrar.».
  - Alerta E-05: «Hay {n} operación(es) de este dispositivo sin sincronizar (E-05): el cierre no se puede confirmar hasta que se apliquen. El arqueo se puede preparar y contar igual.»
  - Sección «Arqueo»: «Fecha del cierre» (por defecto, hoy en Bogotá; obligatoria) con la ayuda «Fecha con la que queda registrado este cierre. No cambia lo que se va a cerrar.» (F-22); «Efectivo contado» (número ≥ 0, obligatorio); «Diferencia estimada: {x}» (= efectivo contado − efectivo esperado; + « — las observaciones son obligatorias.» si no es cero); «Observaciones» / «Observaciones (obligatorio)»; botón «Registrar cierre» («Cerrando…» / «Requiere conexión»).
  - Éxito: «Cierre registrado. Diferencia final: {x}» — queda visible hasta cambiar la «Fecha del cierre» o registrar otro cierre (cambiar la fecha del resumen no lo borra).
  - Sección «Cierres anteriores»: tabla «Fecha», «Efectivo esperado», «Efectivo contado», «Diferencia», «Observaciones» («—» si no hay); vacío «Todavía no hay cierres registrados.».
- **Pasos del cierre:** revisar «Lo que se va a cerrar» → confirmar la «Fecha del cierre» → contar el efectivo físico → escribir «Efectivo contado» → si la diferencia no es cero, escribir observaciones → «Registrar cierre» (sin diálogo de confirmación).
- **Mensajes del servidor:** «Ya existe un cierre de caja registrado para esta fecha.»; «observaciones es obligatorio cuando hay una diferencia en el arqueo.»; genérico «No se pudo registrar el cierre.».
- **Resumen del día ≠ lo que se va a cerrar:** el resumen cuenta el día elegido, incluye pagos pendientes y no descuenta gastos del efectivo. El cierre consolida todo lo **confirmado** que aún no está en ningún cierre, de cualquier día, y su «Efectivo esperado» ya resta los gastos en efectivo (D14). Ver el glosario de `04b`.
- **Endpoints:** `GET /api/movimientos-caja/resumen/?fecha=`, `GET /api/movimientos-caja/pendientes/`, `GET /api/cierres-caja/vista-previa/` (D28), `GET /api/cierres-caja/`, `POST /api/cierres-caja/`. **CU-15, CU-20.**

## P-14 Novedades *(cambió: A7, A2, B5)*

- **Ruta:** `/novedades` · **Roles:** ADMIN, OPERADOR · **Offline:** lectura de la copia local.
- **Elementos:** título «Novedades»; casilla «Solo pendientes» (marcada por defecto); tabla «Recurso», «Código», «Mensaje», «Fecha en el dispositivo» (fecha y hora), «Acciones» («Marcar atendida», deshabilitado sin conexión). La columna «Recurso» muestra nombres legibles: «Venta», «Producto en cuenta de mesa», «Cobro de cuenta de mesa», «Cancelación de cuenta de mesa», «Mesa», «Orden de trabajo», «Cambio de estado de orden», «Abono», «Consumo de orden», «Costo operativo», «Movimiento de inventario», «Gasto», «Configuración de módulos» (un recurso desconocido sale con su código).
- **Pasos:** leer la novedad → corregir con una operación nueva en la pantalla que corresponda → «Marcar atendida».
- **Mensajes:** «Cargando…»; vacío «No hay novedades.»; «No se pudieron cargar las novedades.»; «No se pudo marcar como atendida (requiere conexión).».
- **Endpoints:** `GET /api/sync/novedades/?atendida=false`, `PATCH /api/sync/novedades/{id}/`. **CU-23.**

## P-15 Catálogo *(cambió: A2)*

- Igual que la versión del 02/10, salvo que «Precio venta» y «Costo producción» se ven en pesos («—» si no hay costo). **Offline:** solo lectura (F-2). **CU-05.**
- **Elementos:** título «Catálogo». «Categorías»: «Nueva categoría»; lista con «Editar»; vacío «Todavía no hay categorías.». «Productos»: «Nuevo producto» (deshabilitado sin categorías, ayuda «Crea primero una categoría»); filtros «Categoría» («Todas») y «Tipo» («Todos», «Reventa directa», «Insumo de producción»); tabla «Nombre», «Categoría», «Tipo», «Precio venta», «Costo producción», «Stock actual», «Stock mínimo», «Estado» («Activo» / «Inactivo»), «Acciones» («Editar», «Desactivar» / «Reactivar»); vacío «Ningún producto coincide con los filtros.».
- Formularios y mensajes: sin cambios (ver versión anterior; «Precio de venta (COP)», «Costo de producción (COP, opcional)», «Unidad de medida», «Controla existencias propias», «Stock mínimo», «Stock actual: {n} (lo calcula el backend; no se edita aquí)»).

## P-16 Mesas *(sin cambios)*

- **Ruta:** `/mesas` · **Roles:** ADMIN · **Offline:** sí (se encola). Título «Mesas»; «Nueva mesa»; tabla «Número», «Estado» («Ocupada» / «Disponible»), «Activa» («Activa» / «Inactiva»), «Acciones» («Desactivar» / «Reactivar»; deshabilitado en mesa ocupada con ayuda «No se puede desactivar una mesa con una sesión abierta»). Formulario «Nueva mesa»: «Número (1 a 15)», «Cancelar», «Guardar». Mensajes: «Cargando mesas…»; «Todavía no hay mesas registradas.»; «No se pudieron cargar las mesas.»; «No se pudo cambiar el estado de la mesa.»; «No se pudo crear la mesa.»; «La instalación ya tiene 15 mesas activas.». **CU-19.**

## P-17 Usuarios *(sin cambios)*

- **Ruta:** `/usuarios` · **Roles:** ADMIN · **Offline:** no. Textos iguales a la versión del 02/10 («Nuevo operador», «Requiere conexión», «No se puede desactivar al único administrador», «Nueva contraseña (dejar en blanco para no cambiarla)», etc.). **CU-18.**

## P-18 Configuración *(sin cambios)*

- **Ruta:** `/configuracion` · **Roles:** ADMIN · **Offline:** módulos sí; medios de pago no. «Módulos»: «Ventas», «Inventario», «Servicios», «Finanzas» (se aplica al tocar). «Medios de pago»: «Efectivo», «Transferencia», «QR», «Titular Nequi», «Llave Nequi» (+ « (obligatoria)»), «Guardar» («Guardando…» / «Requiere conexión»). Mensajes iguales a la versión del 02/10. **CU-16, CU-22.**

## P-19 Dispositivos *(cambió: A2)*

- Igual que la versión del 02/10; la columna «Última sincronización» muestra fecha y hora de Bogotá («—» si nunca). **Roles:** ADMIN · **Offline:** no. Textos: «Este dispositivo ya está registrado.» / «Este dispositivo todavía no está registrado. Regístralo para poder autorizarlo a trabajar sin conexión.»; «Registrar este dispositivo»; «Nombre» (ayuda «Ej. Caja principal»); tabla «Nombre» (+ « (este dispositivo)»), «Autorizado offline», «Activo», «Última sincronización», «Acciones» («Autorizar», «Revocar», «Desactivar»). **CU-21.**

---

## Hallazgos de interfaz vigentes (lectura de código; confirmar en navegador)

Corregidos desde la versión del 02/10: F-1, F-3, F-4, F-5, F-6, F-7, F-8 y, en la rama `correcciones-sesion-y-cierre` (informe `11`), F-19 a F-23 (tabla completa con commits en `03 §15` y `05 §6.3`).

| ID | Pantalla | Hallazgo | Estado | Evidencia |
|---|---|---|---|---|
| F-2 | Catálogo | Crear/editar categorías y productos no usa la cola: sin conexión falla | **Abierto** | `api/catalogo.ts` |
| F-19 | Todas (D27) | Con wifi sin internet o servidor dormido, el cierre por inactividad podía dejar al usuario sin poder volver a entrar | **Corregido** (`24e7c46`) | `componentes/Layout.tsx:53-54`; `api/salud.ts` |
| F-20 | Todas (D27) | Cerrar y abrir la app reiniciaba la cuenta de inactividad | **Corregido** (`7688cb7`) | `contexto/inactividad.ts:32-42`; `Layout.tsx:91-99` |
| F-21 | Caja → Cierre | «Lo que se va a cerrar» no mostraba los totales por medio de pago ni la cantidad de movimientos | **Corregido** (`f1c58f2`) | `componentes/PanelCierreCaja.tsx:183-191` |
| F-22 | Caja → Cierre | «Fecha» aparecía arriba de «Lo que se va a cerrar» sin filtrarla y compartía valor con el resumen | **Corregido** (`d782bbd`) | `PanelCierreCaja.tsx:213-223` |
| F-23 | Cuenta de mesa | El diálogo de salida decía que la bandeja se descartaba, pero con el gesto «atrás» se conservaba | **Corregido** (`49e6f17`) | `paginas/DetalleSesion.tsx:506-531` |

---

## Cambios respecto a la versión del 03/10 (`7326a5a`)

- P-02: el cierre por inactividad exige que el servidor responda (F-19) y la cuenta sigue aunque se cierre la app (F-20); `GET /api/health/` en los endpoints.
- P-06: nuevo texto y botones del diálogo «Productos sin agregar»; «Salir» conserva la bandeja (F-23); qué pasa con la bandeja al cobrar o cancelar.
- P-13: «Fecha» solo en «Resumen del día»; «Fecha del cierre» con ayuda dentro de «Arqueo» (F-22); totales por medio de pago y «Movimientos incluidos» en «Lo que se va a cerrar» (F-21).
- Hallazgos: F-19…F-23 marcados como corregidos, con su commit; queda abierto F-2.

## Cambios respecto a la versión del 02/10

- Elementos comunes: formato de moneda y fechas, bandeja de selección, «+{n}» en las tarjetas y avisos de inactividad (D27).
- P-01: tres mensajes de error distintos según la causa (A4).
- P-02: barra superior de cuenta en celular (E-16), nombre de usuario, menú sin «Ingreso» ni «Cierre» y cierre por inactividad.
- P-03: accesos rápidos 10 (ADMIN) / 5 (OPERADOR).
- P-04: el mapa funciona sin conexión, con «provisional» (B4).
- P-05: el carrito es la bandeja, con botón «Cobrar ({n})», persistente y con confirmación al cancelar (E-12/E-17/E-19).
- P-06: rehecha con el vocabulario de «cuenta» (A3 y `7326a5a`), la bandeja, el agrupado de líneas y los diálogos de salida y cobro.
- P-07, P-09, P-14, P-15, P-19: formatos; «Anulado» en abonos; recursos legibles en Novedades.
- P-10: rehecha; ahora incluye el ingreso de mercancía, las pestañas Merma/Ajuste y etiquetas legibles del historial (E-13, A7).
- P-11: marcada como integrada en P-10.
- P-12 y P-13: Caja con pestañas (E-18); P-13 rehecha con la vista previa del cierre (D28), Transferencia y QR en el resumen, cierres anteriores y mensaje de éxito persistente (A5).
- Hallazgos: se quitan los corregidos y se agregan F-19…F-23.
