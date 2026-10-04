Actualizado al commit 49e6f17 (04/10/2026)

# 04b — Manual de usuario: primer uso, instalación, capturas, glosario y problemas frecuentes

> Continúa `04a_pantallas_manual_usuario.md`. Textos de interfaz copiados exactos del código.

---

## 1. Flujo de primer uso (instalación sin usuarios)

| # | Paso | Quién / dónde | Cómo, según el código | Evidencia |
|---|---|---|---|---|
| 1 | Crear el Administrador inicial | Técnico, fuera de la app | **No hay pantalla de registro.** Se envía `POST /api/auth/register/` con `nombre_completo`, `username` y `password` (curl o Postman). Respuesta 201 `{usuario_id, rol: "ADMIN"}`. Solo funciona con la base vacía; después responde 409 | `README.md` §4; `DESPLIEGUE.md` §3; `backend/usuarios/services.py:12-45` |
| 2 | Iniciar sesión | ADMIN, P-01 | «Usuario» + «Contraseña» → «Ingresar». Requiere conexión; sin ella aparece «No hay conexión. El primer inicio de sesión necesita internet.» | `paginas/Login.tsx:14-21` |
| 3 | Revisar módulos | ADMIN, Configuración → «Módulos» | Nacen todos activos; desmarcar los que el negocio no use | `backend/core/models.py:56-59` |
| 4 | Medios de pago y llave Nequi | ADMIN, Configuración → «Medios de pago» | La instalación nace solo con «Efectivo» (D9). Para aceptar «Transferencia» o «QR» hay que escribir la «Llave Nequi» (obligatoria) y, si se quiere, el «Titular Nequi» → «Guardar» (requiere conexión) | `backend/core/models.py:88-92`; `paginas/Configuracion.tsx` |
| 5 | Crear mesas | ADMIN, Mesas → «Nueva mesa» | «Número (1 a 15)» → «Guardar». Máximo 15 activas | `paginas/Mesas.tsx` |
| 6 | Crear categorías | ADMIN, Catálogo → «Nueva categoría» | «Nombre» → «Guardar» (requiere conexión) | `componentes/FormularioCategoria.tsx` |
| 7 | Crear productos | ADMIN, Catálogo → «Nuevo producto» | Categoría, nombre, tipo, «Precio de venta (COP)», costo (opcional), «Unidad de medida», «Controla existencias propias» (desmarcarla en preparados como un tinto) y «Stock mínimo» | `componentes/FormularioProducto.tsx` |
| 8 | Cargar existencias iniciales | ADMIN u OPERADOR, **Inventario → «Registrar movimiento» → pestaña «Ingreso»** (en celular, el botón «Registrar movimiento» abre el panel) | Para cada producto que controla stock: «Producto», «Cantidad», «Motivo (opcional)» → «Registrar ingreso». Truco: tocar la fila del producto en la tabla lo deja elegido en el panel. Sin este paso, vender esos productos da «No hay existencias suficientes…» | `paginas/Inventario.tsx`; `componentes/PanelMovimientoInventario.tsx` |
| 9 | Crear usuarios Operador | ADMIN, Usuarios → «Nuevo operador» | «Nombre completo», «Usuario», «Contraseña» → «Guardar» (requiere conexión). Siempre se crea con rol Operador | `componentes/FormularioUsuario.tsx` |
| 10 | Autorizar el dispositivo que trabajará sin conexión | ADMIN, **en ese mismo equipo**, Dispositivos | «Nombre» (p. ej. «Tablet caja») → «Registrar este dispositivo» → «Autorizar». Solo un equipo queda autorizado; autorizar otro revoca el anterior | `paginas/Dispositivos.tsx` |
| 11 | Entregar el equipo al Operador | ADMIN | «Cerrar sesión» (en celular, en el botón «👤 {usuario}» de la barra superior; en escritorio, al pie de la barra lateral). Solo funciona si no hay operaciones pendientes. Luego el Operador inicia sesión **con conexión** la primera vez | `componentes/Layout.tsx:101-154`; `contexto/SesionContext.tsx:79-92` |

No existen datos de ejemplo precargados (`02b §12`): el catálogo, las mesas y los usuarios de Aroma & Co. se deben crear a mano.

---

## 2. Instalar la PWA

La app ofrece un manifest con `name`/`short_name` «SADIM», `display: standalone`, `start_url: /`, `lang: es`, color `#aa3bff` e íconos PNG 192/512, uno *maskable* y `apple-touch-icon` para iOS (`vite.config.ts:18-33`, `index.html:6`). El ícono es una «S» blanca sobre fondo morado. La app **no** tiene un botón propio «Instalar» (no maneja `beforeinstallprompt`: NO ENCONTRADO en `src/`). La instalación se hace desde el menú del navegador y exige HTTPS (Render lo cumple) o `localhost`.

| Plataforma | Pasos (menús del navegador, no de SADIM) | Observaciones |
|---|---|---|
| Android (Chrome) | Abrir la URL de SADIM → menú «⋮» → «Instalar app» o «Agregar a la pantalla principal» | Requiere Chrome 111+ (`03 §13`). El lanzador puede recortar el ícono en círculo; para eso existe la versión *maskable* |
| iPhone / iPad (Safari) | Abrir la URL en Safari → «Compartir» → «Agregar a pantalla de inicio» | Requiere iOS/iPadOS 16.4+. Usa `apple-touch-icon.png` y el nombre «SADIM» |
| Escritorio (Chrome / Edge) | Ícono «Instalar» en la barra de direcciones, o menú → «Instalar SADIM» | Abre en ventana propia, sin barra de direcciones |

Después de la primera visita con conexión, la app abre sin internet (shell en caché). Las actualizaciones se instalan solas al volver a abrirla (`registerType: 'autoUpdate'`). Ninguno de estos pasos se probó en un dispositivo real (informe 10 §5, puntos 3 y 4).

---

## 3. Lista de capturas para el manual

Orden según el recorrido lógico del manual. «Datos previos» = lo que debe existir para que la pantalla se vea completa. Celular = ventana de menos de 768 px.

| ID | Pantalla | Rol | Datos previos necesarios | Qué resaltar |
|---|---|---|---|---|
| C-01 | Inicio de sesión (P-01) | — | Ninguno | Campos «Usuario» y «Contraseña», botón «Ingresar», pestaña «SADIM» |
| C-02 | Inicio de sesión con error | — | Usuario existente | «El usuario o la contraseña no son correctos.» |
| C-03 | Inicio de sesión sin conexión | — | Modo avión | «No hay conexión. El primer inicio de sesión necesita internet.» |
| C-04 | Inicio — escritorio (P-03) | ADMIN | Todos los módulos activos | «Hola, Administrador», indicador «En línea», 10 accesos rápidos; pie de la barra lateral con usuario, rol y «Cerrar sesión» |
| C-05 | Inicio — celular | OPERADOR | Celular | Barra superior «SADIM» + «👤 {usuario}»; barra inferior Inicio · Ventas · Stock · Órdenes · Más |
| C-06 | Panel de cuenta abierto (celular) | OPERADOR | Celular | Usuario, rol, indicador y «Cerrar sesión» |
| C-07 | Hoja «Más» abierta (celular) | ADMIN | Celular | Órdenes, Caja, Novedades, Catálogo, Usuarios, Configuración, Dispositivos |
| C-08 | Configuración — módulos y medios de pago (P-18) | ADMIN | Transferencia y QR activos, llave Nequi y titular cargados | Casillas de módulos; «Llave Nequi (obligatoria)» |
| C-09 | Mesas (P-16) | ADMIN | 6 mesas (1–6), 1 inactiva, 2 ocupadas | Ocupada/Disponible; «Desactivar» deshabilitado en la ocupada |
| C-10 | Catálogo (P-15) | ADMIN | 4 categorías (Bebidas calientes, Bebidas frías, Panadería, Empacados), ≥ 8 productos, 1 inactivo, 1 tinto con `controla_stock=false` | Precios en pesos, insignias Activo/Inactivo, «—» en el stock del tinto |
| C-11 | Formulario «Nuevo producto» | ADMIN | Al menos una categoría | «Controla existencias propias» y «Stock mínimo» |
| C-12 | Usuarios (P-17) | ADMIN | ADMIN + 1 Operador activo + 1 inactivo | «Nuevo operador», «Desactivar» deshabilitado en el ADMIN |
| C-13 | Dispositivos (P-19) | ADMIN | Este equipo registrado y autorizado + otro sin autorizar | «(este dispositivo)», «Autorizado offline: Sí», fecha de «Última sincronización» |
| C-14 | Inventario — escritorio con panel (P-10) | ADMIN | ≥ 1 producto en o bajo el mínimo, 1 sin control de stock | Tabla a la izquierda, panel «Registrar movimiento» con pestañas «Ingreso / Merma / Ajuste» a la derecha, insignia «Stock mínimo» |
| C-15 | Inventario — ingreso registrado | OPERADOR | Productos con control de stock | Panel sin pestañas, «Ingreso registrado: +{n} unidades.» |
| C-16 | Inventario — celular con hoja de movimiento | OPERADOR | Celular | Botón «Registrar movimiento» y la hoja con «Cerrar» |
| C-17 | Inventario — historial y ajuste | ADMIN | Producto con ingreso, salida por venta y merma | «Historial — {producto}» con tipos legibles; pestaña «Ajuste» con «Sentido» |
| C-18 | Ventas — mapa de mesas (P-04) | OPERADOR | 6 mesas activas, 2 ocupadas con consumos | «Ocupada» con «Total: $ …», botón «Venta rápida» |
| C-19 | Mapa de mesas sin conexión | OPERADOR | Modo avión, una cuenta abierta offline | Aviso de copia local y «provisional» junto al total |
| C-20 | Venta rápida con carrito — escritorio (P-05) | OPERADOR | Transferencia habilitada; 2–3 productos tocados | Tarjetas con «+{n}», bandeja «Selección», «Total estimado», nota Nequi, «Cobrar (n)» |
| C-21 | Venta rápida — celular | OPERADOR | Celular, 3 productos tocados | Barra compacta «3 productos · $ …» y la hoja abierta |
| C-22 | Venta rápida con error de stock | OPERADOR | Producto con stock 1, pedir 3 | «No hay existencias suficientes: …» |
| C-23 | Cuenta de mesa sin abrir (P-06) | OPERADOR | Mesa libre | «Esta mesa no tiene una cuenta abierta. Agrega el primer producto para abrirla.» |
| C-24 | Cuenta de mesa con consumos | OPERADOR | Mesa con 3 productos (uno agregado dos veces) | Tabla agrupada, «Quitar últimos {n}», «Total», sección «Cobrar cuenta» con «Cobrar y cerrar cuenta» |
| C-25 | Bandeja con productos sin agregar | OPERADOR | 2 productos en la bandeja, sin agregar; pulsar «Volver al mapa de mesas» | Diálogo «Productos sin agregar» con «Quedan guardados en la bandeja hasta que los agregues o los quites.» y los botones «Quedarme» / «Salir» (F-23). Captura aparte, si se quiere: «¿Cerrar la cuenta sin ellos?» al cobrar |
| C-26 | Diálogo cancelar cuenta | OPERADOR | Cuenta abierta | «¿Seguro que quieres cancelar esta cuenta? No se cobrará nada ni se descontará inventario.» |
| C-27 | Órdenes de trabajo (P-07) | OPERADOR | 4 órdenes, una en cada estado | Filtro por estado, fechas «d/m/aaaa», saldo en pesos |
| C-28 | Formulario «Nuevo pedido» (P-08) | OPERADOR | — | Campos obligatorios y «Fecha de entrega estimada» |
| C-29 | Detalle de orden — vista Operador (P-09) | OPERADOR | Orden en LISTO con 3 abonos (efectivo, transferencia pendiente, uno anulado) y 2 consumos pendientes | «Pendiente de verificación» y «Anulado»; no aparece «Costos operativos» |
| C-30 | Detalle de orden — vista Admin con costos | ADMIN | Misma orden con 2 costos operativos | «Utilidad neta», tabla de costos |
| C-31 | Diálogo de entrega | ADMIN u OPERADOR | Orden en LISTO | «Pasar a ENTREGADO descuenta el inventario de los consumos pendientes. ¿Continuar?» |
| C-32 | Caja — pestaña «Gastos» (P-12) | OPERADOR | Medios habilitados | Pestañas «Gastos / Pagos pendientes» (solo dos para el Operador), «Gasto registrado.» |
| C-33 | Caja — pestaña «Pagos pendientes» | ADMIN | 1 venta, 1 abono y 1 gasto por transferencia/QR sin confirmar | Cuatro pestañas, «Confirmar», «Motivo de anulación», «Anular» |
| C-34 | Caja — pestaña «Resumen del día» (P-13) | ADMIN | Día con ventas en efectivo, transferencia y QR, 1 abono pendiente, 1 gasto | Campo «Fecha» (filtro), las tres líneas por medio de pago, «Pendiente de verificación (no entra al cierre)» y la alerta de cobros pendientes |
| C-35 | Caja — pestaña «Cierre» | ADMIN | Movimientos confirmados de hoy y de un día sin cerrar, en efectivo, transferencia y QR | Sin campo de fecha arriba; «Lo que se va a cerrar» con «Período: desde …», «Efectivo / Transferencia / QR (ingresos)», «Movimientos incluidos» (F-21) y «Efectivo esperado»; nota de días anteriores; en «Arqueo», «Fecha del cierre» con su ayuda (F-22), «Diferencia estimada», «Observaciones (obligatorio)» |
| C-36 | Cierre registrado y cierres anteriores | ADMIN | Recién registrado | «Cierre registrado. Diferencia final: …» debajo de «Fecha del cierre» y la tabla «Cierres anteriores» |
| C-37 | Cierre bloqueado por cola | ADMIN | Dispositivo con operaciones en cola | Alerta E-05 y botón deshabilitado |
| C-38 | Indicador sin conexión con cola | OPERADOR | Modo avión, 3 operaciones registradas | «Sin conexión», «3 operaciones pendientes de sincronizar», «provisional» |
| C-39 | Detalle de orden sin conexión | OPERADOR | Modo avión; abono registrado offline | Aviso de copia local, saldo «provisional» |
| C-40 | Novedades (P-14) | OPERADOR | 1 CONFLICTO `STOCK_INSUFICIENTE` y 1 RECHAZADA tras sincronizar | «Recurso» legible (p. ej. «Cobro de cuenta de mesa»), «Código», «Mensaje», «Marcar atendida» |
| C-41 | Cerrar sesión bloqueado | OPERADOR | Cola pendiente | «Hay {n} operación(es) sin sincronizar. Conéctate para sincronizar antes de cerrar sesión.» |
| C-42 | Aviso de inactividad | OPERADOR | 29 minutos sin tocar, o adelantar `ultima_actividad` 29,5 minutos sin tocar el código (informe `11` §5, pruebas 9 y 12) | «Por inactividad, la sesión se cerrará en 60 segundos…» |
| C-43 | Sesión expirada sin poder cerrarse | OPERADOR | Al minuto 30: modo avión, cola pendiente o red sin servidor (bloqueo de `*/api/*` en DevTools, informe `11` §5, prueba 9) | «La sesión expiró por inactividad. No se cierra todavía…» con el indicador «En línea» si se usó el bloqueo (F-19) |
| C-44 | Instalación en Android | — | Celular con Chrome | Opción «Instalar app» del navegador y el ícono «S» |
| C-45 | App instalada abierta | — | PWA instalada | Ventana standalone, sin barra del navegador |

Capturas afectadas por F-19…F-23 (04/10): C-25 (diálogo nuevo), C-34 (fecha solo en el resumen), C-35 y C-36 (totales por medio de pago y «Fecha del cierre»), C-42 y C-43 (cómo prepararlas sin esperar 30 minutos; C-43 ahora también se da con red pero sin servidor). Si alguna de estas capturas se tomó antes de `49e6f17`, hay que repetirla.

Equivalencias con la lista anterior: la antigua C-13 (Ingreso de mercancía) pasa a C-15; la C-29 (Cierre de caja) se divide en C-34, C-35 y C-36; C-03, C-06, C-16, C-19, C-21, C-25, C-42 y C-43 son nuevas.

---

## 4. Glosario (según el comportamiento real)

| Término | Definición para un comerciante |
|---|---|
| Venta rápida | Venta de mostrador que se registra ya pagada, con uno o varios productos, sin usar mesa. |
| Cuenta de mesa (sesión dinámica) | La cuenta abierta de una mesa: se van agregando productos y se cobra todo al final. Se abre al agregar el primer producto, y la mesa queda «Ocupada». En el código y en el ERD se llama «sesión dinámica»; en pantalla, «cuenta». |
| Cobrar y cerrar cuenta | Cobrar la cuenta de la mesa: descuenta el inventario, registra el ingreso en caja y deja la mesa «Disponible». No tiene nada que ver con «Cerrar sesión», que sale de la aplicación. |
| Cancelar cuenta | Anular una cuenta de mesa abierta por error, sin cobrar ni mover inventario. |
| Bandeja de selección («Selección») | Lista temporal de los productos que se van tocando. Nada se envía hasta pulsar «Agregar a la mesa» o «Cobrar». Queda guardada en el equipo aunque se salga de la mesa (por el menú, por «Volver al mapa de mesas» o con «atrás») o se cierre la app. Se borra al enviarla, al quitar sus productos, al cobrar o cancelar la cuenta de esa mesa, al descartar la venta rápida o al cerrar sesión. |
| Total estimado | Suma que muestra la bandeja con los precios del equipo. El total real lo calcula el servidor. |
| Mesa activa / inactiva | Activa: aparece en el mapa de ventas. Inactiva: guardada pero oculta; no se puede desactivar una mesa ocupada. Máximo 15 activas. |
| Controla existencias propias | El producto lleva conteo de unidades (p. ej. una gaseosa). Si no (p. ej. un tinto preparado), se vende sin descontar ni avisar de stock. |
| Stock actual / stock mínimo | Unidades disponibles según el sistema / nivel desde el cual aparece la alerta «Stock mínimo». |
| Ingreso de mercancía | Registro de unidades que llegan al negocio; suma al stock. Se hace en Inventario → «Registrar movimiento» → «Ingreso». |
| Merma | Pérdida de producto (daño, vencimiento, regalo); resta del stock y exige motivo. Solo el Administrador. |
| Ajuste manual (conteo físico) | Corrección del stock después de contar: «Suma (sobraban unidades)» o «Resta (faltaban unidades)», con motivo. Solo el Administrador. |
| Orden de trabajo / pedido por encargo | Trabajo con cliente y fecha de entrega (p. ej. una torta). Avanza: Recibido → En proceso → Listo → Entregado. |
| Abono | Pago parcial de una orden; reduce el saldo pendiente. No puede superar el saldo. |
| Saldo pendiente | Lo que el cliente aún debe de una orden. |
| Consumo de una orden | Producto o insumo usado en la orden. Queda «Pendiente» y solo se descuenta del inventario al marcar la orden «Entregado». |
| Costo operativo | Gasto asociado a una orden (repuesto, transporte…), visible solo para el Administrador. |
| Utilidad neta | Costo total acordado con el cliente menos los costos operativos registrados (no descuenta insumos). Solo Administrador. |
| Medio de pago | Efectivo, Transferencia o QR (solo los habilitados en Configuración). |
| Llave Nequi | Número o llave que se muestra al cliente para pagar por transferencia o QR. SADIM no verifica el pago. |
| Pendiente de verificación | Cobro por transferencia o QR que nadie ha confirmado todavía. No entra al cierre de caja. |
| Confirmar pago | Marcar que el dinero de una transferencia o QR sí llegó (revisándolo en Nequi). Requiere conexión. |
| Anular pago | Marcar que un pago pendiente nunca llegó, con motivo. Si era un abono, el saldo de la orden vuelve a subir. El inventario no se devuelve. Solo Administrador. |
| Gasto (gasto hormiga) | Salida de dinero de la caja con concepto (p. ej. bolsas). |
| Resumen del día | Lo que pasó **en la fecha elegida**: ventas, abonos, gastos, neto e ingresos por Efectivo, Transferencia y QR, contando también lo pendiente de verificación (que aparece aparte). Sirve para ver cómo va el día; no guarda nada. |
| Lo que se va a cerrar (vista previa del cierre) | Lo que el cierre guardaría si se registrara en este momento: todos los movimientos **confirmados** que todavía no están en ningún cierre, **aunque sean de días anteriores**, desde el último cierre hasta ahora. Muestra ventas, abonos, gastos, neto, ingresos por Efectivo, Transferencia y QR, cuántos movimientos incluye y el efectivo esperado. No depende de ninguna fecha que se elija y no guarda nada. |
| Fecha del cierre | Fecha con la que queda registrado el cierre (la fecha contable; por defecto, hoy). Se elige dentro de «Arqueo». No cambia lo que se va a cerrar, y solo puede haber un cierre por fecha. No es lo mismo que la «Fecha» del «Resumen del día», que solo sirve para consultar. |
| ¿Por qué el resumen y la vista previa no coinciden? | Ejemplo en la cafetería: el lunes no se cerró caja y una transferencia del martes se confirmó el miércoles. El miércoles, el «Resumen del día» muestra solo lo del miércoles e incluye lo pendiente. «Lo que se va a cerrar» muestra lo confirmado del lunes, del martes y del miércoles que aún no tiene cierre, y no muestra lo pendiente. Además, el «Efectivo (ingresos)» del resumen no resta gastos, mientras que el «Efectivo esperado» del cierre sí los resta. |
| Cierre de caja / arqueo | Corte que consolida lo de «Lo que se va a cerrar», compara el efectivo esperado con el contado y guarda la diferencia. Uno por fecha. |
| Efectivo esperado / contado / diferencia | Esperado: ingresos en efectivo menos gastos en efectivo de lo que se va a cerrar. Contado: lo que hay físicamente en la caja. Diferencia: contado − esperado (negativa = faltante). La «Diferencia estimada» se ve mientras se escribe; la «Diferencia final» es la que guarda el servidor. |
| Cierres anteriores | Lista de los cierres ya registrados, con su efectivo esperado, contado, diferencia y observaciones. |
| Sin conexión / modo offline | La app sigue funcionando con los datos guardados en el equipo; lo que se registra queda en cola. |
| Operaciones pendientes de sincronizar (cola) | Registros hechos sin conexión que aún no llegan al servidor. Se envían solos al volver internet. |
| Sincronizar | Enviar la cola al servidor, que valida cada operación y recalcula totales y stock. |
| Provisional | Valor calculado en el equipo mientras hay cola o no hay conexión; el definitivo lo calcula el servidor. |
| Novedad de sincronización | Operación hecha sin conexión que el servidor no pudo aplicar (rechazada o en conflicto). Se revisa, se corrige con un registro nuevo y se marca «atendida». |
| Rechazada / Conflicto | Rechazada: la operación tenía un problema propio (datos, permisos, módulo apagado). Conflicto: era válida, pero la situación cambió (p. ej. ya no hay stock). |
| Dispositivo autorizado | El único equipo que puede enviar operaciones hechas sin conexión. Lo autoriza el Administrador. |
| Cierre de sesión por inactividad | Si nadie toca la app durante 30 minutos, hay conexión, el servidor responde y no quedan operaciones pendientes, la app vuelve a la pantalla de inicio de sesión. Avisa un minuto antes. Sin conexión, con el servidor sin responder (p. ej. wifi sin internet) o con pendientes, solo avisa y deja seguir trabajando. Los 30 minutos se cuentan aunque la app se cierre: si se abre después de más de media hora sin uso, se aplica la misma regla de inmediato. |
| Módulo | Parte de la app que se puede encender o apagar: Ventas, Inventario, Servicios, Finanzas. |
| Administrador / Operador | Roles: el Administrador configura y ve finanzas; el Operador vende, atiende órdenes, registra gastos e ingresos de mercancía. |

---

## 5. Problemas frecuentes del usuario final

| Mensaje que ve | Causa | Qué debe hacer |
|---|---|---|
| «El usuario o la contraseña no son correctos.» | Usuario o contraseña errados, o usuario desactivado | Revisar mayúsculas; pedir al Administrador que verifique que el usuario esté «Activo» o que restablezca la contraseña |
| «No hay conexión. El primer inicio de sesión necesita internet.» | Se intentó entrar sin internet | Conectarse. Para entrar siempre se necesita conexión, incluso si ya se había entrado antes en ese equipo |
| «Hay operaciones sin sincronizar de otro usuario en este dispositivo. Inicia sesión con esa cuenta primero.» | Otra persona dejó registros sin enviar en este equipo | Entrar con esa cuenta, esperar a que se sincronice y cerrar sesión |
| «No se pudo iniciar sesión.» | Otro fallo (raro) | Reintentar; si persiste, avisar al técnico |
| «La sesión terminó. Vuelve a iniciar sesión.» | El token de renovación venció (7 días) o no es válido | Iniciar sesión de nuevo con conexión (si hay cola, con el mismo usuario) |
| «Por inactividad, la sesión se cerrará en 60 segundos…» | 29 minutos sin tocar la app | Tocar la pantalla para seguir; si no, la app vuelve al inicio de sesión |
| «La sesión expiró por inactividad. No se cierra todavía…» | Pasaron 30 minutos (aunque la app haya estado cerrada), pero no hay conexión, el servidor no responde (p. ej. wifi sin internet) o quedan operaciones sin enviar | Se puede seguir trabajando. La sesión se cerrará sola cuando haya conexión, el servidor responda y todo esté sincronizado |
| La app volvió sola a la pantalla de inicio de sesión | Cierre por inactividad: 30 minutos sin uso, con conexión, con el servidor respondiendo y sin pendientes. También pasa al abrir la app después de más de media hora sin usarla | Volver a entrar. Como la app solo cierra si el servidor acaba de responder, en ese momento se puede iniciar sesión |
| «Hay {n} operación(es) sin sincronizar. Conéctate para sincronizar antes de cerrar sesión.» | Hay registros sin enviar | Conectarse y esperar a que el indicador ya no muestre pendientes |
| No encuentro «Cerrar sesión» en el celular | Ahora está en la barra superior | Tocar «👤 {usuario}» arriba a la derecha |
| No encuentro «Ingreso de mercancía» | Se integró en Inventario | Inventario → «Registrar movimiento» → «Ingreso» |
| No encuentro «Cierre de caja» | Ahora es una pestaña de Caja (solo Administrador) | Caja → pestaña «Cierre» |
| «No hay existencias suficientes: {producto} (disponible: x, pedido: y).» | El stock del sistema no alcanza | Registrar un ingreso en Inventario o, si el conteo está mal, que el Administrador haga un ajuste |
| «Supera el stock que se ve en este dispositivo; puede generar un conflicto al sincronizar.» | Sin conexión, la cantidad supera el stock que conoce el equipo | Se puede agregar igual; si al sincronizar falta stock, saldrá una novedad |
| «Productos sin agregar» | Se intenta salir de la mesa con productos tocados en la bandeja sin enviar | «Quedarme» y pulsar «Agregar a la mesa», o «Salir»: los productos quedan guardados en la bandeja de esa mesa y se ven al volver a entrar |
| «¿Cerrar la cuenta sin ellos?» | Se va a cobrar con productos en la bandeja sin enviar | «Volver» y pulsar «Agregar a la mesa», o «Cerrar sin agregarlos»: se cobra lo que ya está en la cuenta y la bandeja se vacía |
| «Algunos productos no se agregaron; quedaron en la bandeja con su error.» | Uno o más productos fallaron al enviarse (p. ej. sin stock) | Leer el error debajo de cada línea, corregir y volver a «Agregar a la mesa» |
| «Hay {n} producto(s) en el carrito. ¿Descartar la venta?» | Se pulsó «Cancelar» en la venta rápida con productos | «Seguir vendiendo» o «Descartar» |
| «El medio de pago {X} no está habilitado en esta instalación.» | Transferencia o QR desactivados en Configuración | Usar otro medio o pedir al Administrador que lo habilite (con llave Nequi) |
| «El producto "{nombre}" está inactivo.» | El Administrador desactivó el producto | Usar otro producto o reactivarlo en Catálogo |
| «La mesa ya tiene una sesión abierta.» | Otro equipo abrió esa mesa | La app vuelve al mapa; entrar a la mesa ocupada |
| «La venta ya está cerrada o cancelada.» | Se intentó modificar una cuenta ya cobrada o cancelada | Abrir una cuenta nueva |
| «Una sesión sin detalles no puede cerrarse; puede cancelarse.» | Cobro de una mesa sin productos | Usar «Cancelar cuenta» |
| «La instalación ya tiene 15 mesas activas.» | Límite de 15 mesas activas | Desactivar una mesa antes de crear o reactivar otra |
| «No se puede desactivar una mesa con una sesión abierta.» | Mesa ocupada | Cobrar o cancelar la cuenta primero |
| «El abono supera el saldo pendiente de la orden.» | Valor mayor que lo que se debe | Registrar como máximo el saldo pendiente |
| «La orden ya fue entregada.» | Se intentó cambiar el estado, un consumo o un costo de una orden entregada | No se puede modificar; registrar una corrección de inventario si hace falta |
| «La orden solo puede avanzar al estado siguiente.» | Salto de estado (raro desde la interfaz) | Avanzar de a un estado |
| «El módulo {modulo} está desactivado.» | El Administrador apagó ese módulo | Pedir al Administrador que lo active en Configuración |
| «No tiene permisos suficientes para realizar esta operación.» | La acción es solo de Administrador | Pedirla al Administrador |
| «Solo se puede anular un movimiento pendiente de verificación.» / «El movimiento ya fue confirmado, anulado o no está pendiente de verificación.» | El pago ya cambió de estado (otro usuario lo confirmó o anuló) | Volver a abrir la pestaña «Pagos pendientes» |
| «Ya existe un cierre de caja registrado para esta fecha.» | Ya se cerró caja con esa «Fecha del cierre» | Elegir otra «Fecha del cierre» en «Arqueo»; los movimientos nuevos entran al siguiente cierre |
| Cambié la «Fecha del cierre» y «Lo que se va a cerrar» no cambió | Es normal: esa fecha solo es la que queda registrada en el cierre | Para ver un día concreto, usar la «Fecha» de la pestaña «Resumen del día» |
| «observaciones es obligatorio cuando hay una diferencia en el arqueo.» | El efectivo contado no coincide con el esperado | Explicar el descuadre en «Observaciones» |
| El «Resumen del día» y «Lo que se va a cerrar» muestran cifras distintas | Miden cosas distintas (ver glosario) | Es normal. Para el arqueo vale «Efectivo esperado» de la pestaña «Cierre» |
| «Requiere conexión.» (texto) o «Requiere conexión» (en un botón) | Acción o consulta que solo funciona en línea: confirmar/anular pagos, resumen del día, cierre, cierres anteriores, usuarios, medios de pago, dispositivos | Conectarse a internet |
| «Pendiente de sincronizar» (en el botón Confirmar) | El gasto todavía está en la cola del equipo | Esperar a que se sincronice |
| El indicador «{n} operaciones pendientes de sincronizar» no baja | Sin internet, sesión vencida o equipo no autorizado | Verificar la conexión; iniciar sesión; pedir al Administrador que autorice el equipo en Dispositivos |
| Aviso «Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.» | Trabajando sin conexión | Es normal; al reconectar, los datos se actualizan solos |
| Novedad «Cobro de cuenta de mesa» con código `STOCK_INSUFICIENTE` | Una cuenta cobrada sin conexión no se pudo aplicar porque el servidor no tenía stock; la cuenta sigue abierta en el servidor | Registrar el ingreso o el ajuste de inventario y volver a cobrar la mesa; luego «Marcar atendida» |
| Novedad con código `OPERACION_PREVIA_FALLIDA` | Dependía de otra operación que falló antes (p. ej. la mesa ya estaba ocupada) | Revisar la novedad anterior, corregir y marcar ambas como atendidas |
| La cola no baja y no aparece ninguna novedad (`DISPOSITIVO_NO_AUTORIZADO`) | El equipo no está autorizado; la cola queda intacta | Administrador → Dispositivos → registrar y «Autorizar» este equipo |

---

## Cambios respecto a la versión del 03/10 (`7326a5a`)

- §3: capturas afectadas por F-19…F-23 (C-25, C-34, C-35, C-36, C-42, C-43), con cómo preparar las de inactividad sin esperar 30 minutos.
- §4: «Bandeja» (salir ya no la descarta, F-23), «Lo que se va a cerrar» (totales por medio de pago y cantidad de movimientos, F-21), término nuevo «Fecha del cierre» (F-22) y «Cierre de sesión por inactividad» (servidor que responde, F-19; cuenta que sigue con la app cerrada, F-20).
- §5: filas de inactividad reescritas (F-19/F-20); «Productos sin agregar» y «¿Cerrar la cuenta sin ellos?» separadas; «Fecha del cierre» en el error de cierre repetido y fila nueva sobre la fecha que no filtra.

## Cambios respecto a la versión del 02/10

- §1: el paso 8 usa Inventario → «Registrar movimiento» → «Ingreso» (E-13); el paso 11 ubica «Cerrar sesión» en la barra superior del celular (E-16); el paso 2 incluye el mensaje sin conexión (A4).
- §2: íconos PNG, maskable y `apple-touch-icon`, `lang es` y color `#aa3bff` (A1). iOS ya no muestra un ícono genérico.
- §3: lista de capturas rehecha (C-01…C-45): barra de cuenta, Inventario con panel, bandeja en escritorio y celular, Caja con cuatro pestañas, vista previa y cierres anteriores, avisos de inactividad, mapa sin conexión. Se indican las equivalencias con la lista vieja.
- §4: nuevos términos: cuenta de mesa, cobrar/cancelar cuenta, bandeja, total estimado, resumen del día frente a «Lo que se va a cerrar» (con ejemplo), cierres anteriores, diferencia estimada frente a final y cierre por inactividad. Se quitó «Cerrar sesión (de una mesa)».
- §5: mensajes de login separados por causa, avisos de inactividad, bandeja, secciones que se movieron, resumen frente a cierre y «Requiere conexión.» en Caja. Se quitó la fila del mapa de mesas sin conexión (F-1 corregido).
