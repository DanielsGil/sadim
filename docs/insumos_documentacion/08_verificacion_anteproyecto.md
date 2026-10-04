Actualizado al commit 7326a5a (03/10/2026)

# 08 — Verificación de afirmaciones del anteproyecto

> Fuente de las afirmaciones: `docs/referencia/00_Anteproyecto_SADIM_v2.md` (citado como «AP:línea»). Respuestas: **SÍ / NO / PARCIAL / DIFERENTE**.

| # | Pregunta | Respuesta | Evidencia y explicación |
|---|---|---|---|
| 1 | ¿Se usa Firebase en algún lugar? | **NO** | Ninguna coincidencia de «firebase» en `backend/`, `frontend/src/`, `package.json` ni `requirements.txt`. Solo aparece en el texto del anteproyecto (AP:447, costos: «Firebase» como herramienta gratuita) y en la documentación que pide eliminarlo (HU-006, `Backlog_Definitivo.md:19`). ADR-001 lo descarta |
| 2 | ¿Se usa SQLite? ¿En qué contexto? | **NO** (en funcionamiento) | `settings.py:121-136` solo configura PostgreSQL (por `DATABASE_URL` o variables sueltas); las pruebas también usan PostgreSQL. Existe el archivo residual `backend/db.sqlite3` (159 KB, 06/09/2026, del scaffold inicial), **no versionado** (`.gitignore:9-10`) y excluido de la imagen Docker. El anteproyecto dice «PostgreSQL/SQLite» (AP:299); `CLAUDE.md` permite SQLite «opcional para pruebas locales» pero el código no lo soporta |
| 3 | Activación de módulos: ¿«clases abstractas para activación dinámica» o banderas de configuración (ADR-006)? | **DIFERENTE** al anteproyecto (coincide con ADR-006) | Banderas booleanas en la fila única `ConfiguracionModulo` (`core/models.py:50-73`) + `ModuloActivoPermission` que responde 403 `MODULO_DESACTIVADO` (`core/permissions.py:44-85`) + ocultamiento del menú (`frontend/src/componentes/navegacion.ts:43-74`). No hay clases abstractas ni carga dinámica (la única clase abstracta usada es `AbstractBaseUser` de Django). AP:308 dice «clases abstractas para la activación dinámica» |
| 4 | ¿Los insumos de producción se descuentan automáticamente tras cada venta? | **NO** | No hay recetas. Al cerrar una venta solo se descuenta el propio producto vendido si `controla_stock=true` (`ventas/services.py:201-202`, `:372-375`). Un preparado (p. ej. tinto) se registra con `controla_stock=false` y no descuenta nada; sus insumos se controlan aparte (ingresos, consumos de órdenes, mermas, ajustes) — ERD §5.6, R-18. AP:183 afirma «descuento automático tras cada venta» para insumos y reventa |
| 5 | ¿Existe «Inventario_Final = Inventario_Inicial + Producción − Ventas» o producción diaria? | **NO** | No hay entidad ni cálculo de producción, ni stock inicial/final por día. `stock_actual` se actualiza por movimientos (`inventario/services.py`). AP:318 y AP:197 («lógica de producción diaria») no se implementaron |
| 6 | ¿Hay escaneo de códigos con la cámara? | **NO** | Sin coincidencias de `getUserMedia`, `BarcodeDetector`, «cámara», «escaneo» en el código; `Producto` no tiene campo de código de barras. AP:259 lo menciona |
| 7 | ¿Se registran «cambios de moneda» como caso extra de caja? | **NO** | `MovimientoCaja.tipo` solo admite `INGRESO_VENTA`, `INGRESO_ABONO`, `GASTO` (`finanzas/models.py:19-22`). Los CU dicen que el cambio entregado no se modela (`03_Casos_de_Uso…:764`). La pantalla de Caja no tiene «Caso extra». AP:195 lo afirma |
| 8 | ¿Se calculan o muestran márgenes de ganancia por producto? | **NO** | Se guarda `costo_produccion` (opcional) y `precio_venta`, y el ADMIN ve ambas columnas en Catálogo (`paginas/Catalogo.tsx`), pero no hay cálculo ni visualización de margen. AP:197 («precios y márgenes de ganancia»), AP:187 |
| 9 | ¿Hay dashboard de flujo de caja diario (ingresos vs. gastos)? ¿Qué muestra? | **PARCIAL** | No hay dashboard independiente ni gráficos. El **Resumen del día** es una pestaña de Caja, solo para ADMIN (`frontend/src/paginas/Caja.tsx:44-53`; `componentes/PanelCierreCaja.tsx:114-144`, E-18). Para la fecha elegida muestra: «Ingresos por ventas», «Ingresos por abonos», «Gastos», «Neto», «Efectivo (ingresos)», «Transferencia (ingresos)», «QR (ingresos)» y «Pendiente de verificación (no entra al cierre)», más la alerta de cobros pendientes. Transferencia y QR se agregaron en A5 (`3072214`); antes el API los devolvía pero la pantalla no. Las cifras las calcula el servidor (`GET /api/movimientos-caja/resumen/`, `backend/finanzas/services.py:148-189`). Inicio sigue sin KPI (wireframe 2 no implementado). AP:225 |
| 10 | El análisis de costos por orden, ¿calcula utilidad neta? ¿Fórmula? | **SÍ** | `utilidad_neta = costo_total − Σ CostoOperativoOrden.valor` (`servicios/services.py:284-287`), calculada en el backend, inicializada en `costo_total`, visible solo para ADMIN (`servicios/serializers.py:51-57`). No descuenta insumos consumidos ni depende de los abonos |
| 11 | ¿Medios EFECTIVO, TRANSFERENCIA y QR? ¿Cómo se usa la llave Nequi? | **SÍ** | Enum en Venta, Abono y MovimientoCaja. Cada medio se habilita en `ConfiguracionPago`; la instalación nace solo con efectivo (D9). La llave Nequi (`nequi_llave`, obligatoria si hay transferencia o QR) y el titular se muestran como texto al elegir Transferencia/QR: «Nequi {titular}: {llave} — el cobro queda pendiente de verificación, nunca como pagado.» (`FormularioVentaRapida.tsx`, `DetalleSesion.tsx`, `DetalleOrden.tsx`). SADIM no genera QR ni verifica el pago: queda `PENDIENTE_VERIFICACION` hasta que un usuario lo confirme en línea |
| 12 | ¿Límite de mesas activas (15)? | **SÍ** | CHECK `numero` 1..15 (`ventas/models.py:26-29`) y límite de 15 mesas con `activa=true` al crear o reactivar → 409 `LIMITE_MESAS_EXCEDIDO` (`ventas/services.py:18`, `:31-38`, `:62-68`). Probado en `ventas/tests.py::MesaTests` |
| 13 | ¿Órdenes RECIBIDO → EN_PROCESO → LISTO → ENTREGADO, con fecha de entrega, múltiples abonos y saldo? | **SÍ** | Transición estricta de a un estado (`servicios/services.py:143-180`); `fecha_entrega_estimada` (fecha, sin hora); N abonos por orden con validación de saldo; `saldo_pendiente` mantenido por el backend. Al entregar se aplican los consumos de forma atómica |
| 14 | ¿Qué se le oculta exactamente al OPERADOR? | — | **Campos:** `costo_produccion` de productos y `utilidad_neta` de órdenes (no viajan en la respuesta). **Recursos (403):** costos operativos, histórico de movimientos de caja, resumen diario, cierres de caja, gestión de usuarios, escritura de catálogo/mesas/configuración, dispositivos, MERMA/AJUSTE_MANUAL, anular pagos. **Interfaz:** menús Mesas, Catálogo, Usuarios, Configuración y Dispositivos, y las pestañas «Resumen del día» y «Cierre» de Caja (`frontend/src/paginas/Caja.tsx:44-53`); las pestañas Merma y Ajuste de Inventario. **Lo que sí ve:** total de cada venta, `costo_total` y saldo de órdenes, montos de pagos pendientes, stock (ver `02b §5`) |
| 15 | Compatibilidad mínima real de navegadores y SO | **DIFERENTE** | Bundle con target Vite 8 por defecto: Chrome/Edge 111+, Firefox 114+, Safari/iOS 16.4+; requiere contexto seguro (HTTPS) por service worker y `crypto.randomUUID`. El anteproyecto (AP:251-253) afirma Chrome 70+, Firefox 67+, Safari 11.3+, Edge 79+, Android 5.0+, iOS 11.3+: **no se cumple** (ver `03 §9`) |
| 16 | ¿Referencias a Figma u otros artefactos de diseño? | **PARCIAL** | Solo el criterio de aceptación de HU-004 dice «Mockups en Figma de módulos y dashboard» (`Backlog_Definitivo.md:11`). No hay enlaces de Figma, archivos `.fig`, ni las imágenes de los wireframes (el documento 04 solo conserva los pies «Figura 1…7») |
| 17 | ¿«Análisis multimodal de pagos» (consolidación por medio de pago en el cierre)? | **PARCIAL** | (1) El resumen diario agrupa los ingresos por EFECTIVO/TRANSFERENCIA/QR (`backend/finanzas/services.py:148-189`) y desde A5 la pestaña «Resumen del día» muestra las tres líneas. (2) La vista previa del cierre (D28, `GET /api/cierres-caja/vista-previa/`) calcula `por_medio_pago` sobre exactamente lo que se va a cerrar (`finanzas/services.py:244-250`, compartido con `crear_cierre`). (3) Pero `CierreCaja` sigue guardando solo totales por tipo y el **efectivo** esperado/contado/diferencia (`finanzas/models.py:115-159`): no persiste totales por transferencia ni QR. (4) La pestaña «Cierre» tampoco muestra `por_medio_pago`: solo ventas, abonos, gastos, neto y efectivo esperado (`frontend/src/componentes/PanelCierreCaja.tsx:153-175`, F-21). (5) La tabla «Cierres anteriores» muestra solo efectivo. CU-15 pide «presentar los totales por medio de pago»: el dato existe en el servidor al momento de cerrar, pero ni se guarda ni se presenta. AP:213 |

---

## Funcionalidades implementadas que el anteproyecto no menciona

| Funcionalidad | Evidencia |
|---|---|
| Dispositivo autorizado único para trabajar sin conexión (registro, autorización, revocación, `X-Device-Id`) | `core/models.py:9-35`, `core/services.py:40-87`, `paginas/Dispositivos.tsx` |
| Cola de sincronización offline con idempotencia por `operation_id` y estados APLICADA/DUPLICADA/RECHAZADA/CONFLICTO | `core/idempotencia.py`, `core/sync.py`, `frontend/src/sync/` |
| Novedades de sincronización (bandeja para revisar y marcar atendidas) | `core/sync.py:494-543`, `paginas/Novedades.tsx` |
| Confirmación manual de pagos electrónicos pendientes de verificación | `finanzas/services.py:69-98`, `paginas/Caja.tsx` (pestaña «Pagos pendientes») |
| Anulación de pagos que nunca llegaron (con motivo; devuelve saldo al abono) | `finanzas/services.py:101-135` (D15) |
| Cierre de caja con arqueo (efectivo esperado/contado/diferencia, observaciones obligatorias) y un cierre por fecha | `finanzas/services.py:277-339` |
| Vista previa del cierre (lo que se va a consolidar, sin guardar) y lista de cierres anteriores | `finanzas/services.py:262-274`, `views.py:171-178` (D28); `componentes/PanelCierreCaja.tsx` |
| Cancelación de una sesión de mesa abierta por error | `ventas/services.py:402-421` |
| Validación de stock al agregar a la cuenta (sin descontar) | `ventas/services.py:263-283` (D24) |
| Configuración de medios de pago y llave Nequi por el ADMIN | `core/models.py:76-116`, `paginas/Configuracion.tsx` |
| Registro público del ADMIN inicial bloqueado tras el primer usuario | `usuarios/services.py:12-45` |
| Protección del único ADMIN activo | `usuarios/services.py:48-71` |
| Vistas «provisionales» sin conexión y advertencias no bloqueantes | `frontend/src/sync/vistaLocal*.ts`, `componentes/AvisoLocal.tsx` |
| Bloqueo de cambio de usuario / cierre de sesión con operaciones pendientes | `contexto/SesionContext.tsx:66-92` (D21) |
| Navegación móvil con barra superior de cuenta, barra inferior y hoja «Más» | `componentes/Layout.tsx:128-228` (E-16) |
| Bandeja de selección de productos, persistente en el dispositivo | `componentes/BandejaSeleccion.tsx`, `useBandejaPersistente.ts` (E-12, E-17, E-19) |
| Cierre de sesión por inactividad que respeta la cola offline | `contexto/inactividad.ts`, `componentes/Layout.tsx:41-76` (D27) |
| Formato de moneda COP y fechas en hora de Bogotá | `utilidades/formato.ts` (A2) |
| Despliegue en Render (Docker) + Neon, health check | `Dockerfile`, `render.yaml`, `core/views.py:21-30` |
| Formato de error uniforme `{code, message, details}` | `core/exceptions.py` |

---

## Cambios respecto a la versión del 02/10

- Pregunta 9: el Resumen del día ahora es una pestaña de Caja (E-18) y muestra también Transferencia y QR (A5).
- Pregunta 14: los menús ocultos al OPERADOR ya no incluyen «Cierre de caja» (es una pestaña de Caja); se agregan las pestañas ocultas.
- Pregunta 17: se agrega la vista previa del cierre (D28), que calcula `por_medio_pago`; sigue PARCIAL porque `CierreCaja` no lo guarda y la PWA no lo muestra (F-21).
- Pregunta 3 y tabla final: referencias actualizadas; funcionalidades nuevas (vista previa del cierre, bandeja, barra de cuenta, cierre por inactividad, formato COP).
- Las preguntas 1, 2, 4–8, 10–13, 15 y 16 no cambian.
