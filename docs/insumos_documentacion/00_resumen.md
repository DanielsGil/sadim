Actualizado al commit 7326a5a (03/10/2026)

# 00 — Resumen del inventario verificado de SADIM

> Levantado el 02/10/2026 sobre `main` (`8910c90`) y actualizado el 03/10/2026 sobre `main` (`7326a5a`, igual a `origin/main`). Esta actualización incorpora los lotes de corrección 4, 5 y 6 (E-10…E-19) y los 13 commits de la rama `correcciones-pre-documentacion` (informe `10`), ya integrada en `main`. Solo lectura: no se modificó código. Archivos: `01` stack y repositorio, `02a`/`02b` backend, `03` frontend y PWA, `04a`/`04b` manual de usuario, `05` pruebas, `06` despliegue, `07` trazabilidad, `08` anteproyecto, `09` diagramas, `10` cambios de la rama de correcciones.

---

## 1. Resumen ejecutivo

SADIM está implementado como un **monolito modular Django 6.1 + DRF 3.18** sobre **PostgreSQL**, con una **PWA React 19 + TypeScript + Vite 8** que usa **Dexie/IndexedDB** y un service worker de **Workbox** (vite-plugin-pwa). Se despliega como un único servicio Docker en **Render (plan Free)**, que sirve la API y la PWA en el mismo dominio, con la base de datos en **Neon**. No hay Firebase ni SQLite en funcionamiento.

**Cobertura funcional.** Los 23 casos de uso (CU-01…CU-23) tienen endpoint, pantalla y prueba automatizada. Desde el 02/10 se agregó un endpoint: `GET /api/cierres-caja/vista-previa/` (D28). Los demás cambios fueron de interfaz y calidad:
- bandeja de selección persistente para mesas y venta rápida;
- Inventario con el ingreso de mercancía en la misma pantalla;
- Caja con pestañas (gastos, pagos pendientes, resumen del día y cierre con vista previa y cierres anteriores);
- barra de cuenta siempre visible en celular;
- cierre de sesión por inactividad (D27);
- mapa de mesas sin conexión;
- precio del dispositivo en la cola (D19);
- identidad propia de la PWA;
- formato COP y fechas de Bogotá;
- `SECRET_KEY` obligatoria en producción.

**Calidad verificada hoy (03/10).**
- 194 pruebas de backend sobre PostgreSQL: **OK** (12,4 s).
- 38 pruebas Vitest en 7 archivos: **OK**.
- `makemigrations --check` sin cambios pendientes (22 migraciones; no hubo nuevas).
- No hay pruebas de interfaz ni E2E, ni CI, ni cobertura medida.

**Cronograma real.** El código funcional se escribió entre el 11/09 y el 21/09/2026. El 27/09 llegaron el despliegue y los lotes de corrección 1–3. El 03/10 entraron 16 commits más (lotes 4–6 y la rama de correcciones). En total hay 61 commits de un solo autor git (Daniel Gil), 59 con coautoría de Claude.

**Lo que falta o queda parcial:**
- La validación con Aroma & Co. (HU-037/038) no tiene evidencia en el repo.
- No se actualizaron el ERD, los CU, los ADR ni el anteproyecto (HU-047/HU-006). D27 y D28 se suman a lo que habría que trasladar.
- El catálogo no se puede editar sin conexión (F-2).
- La documentación final (HU-039/040) sigue en curso, y esta carpeta no está versionada.
- Hay riesgos nuevos detectados en esta revisión, F-19…F-23. El más relevante es F-19: el cierre por inactividad decide si hay conexión con `navigator.onLine`.

---

## 2. Divergencias diseño ↔ implementación (de mayor a menor impacto)

| # | Divergencia | Diseño | Implementación (03/10) | Ver |
|---|---|---|---|---|
| 1 | Validación con usuarios reales | Objetivo general, HU-037/HU-038 | Sin actas, checklists ni resultados en el repo. Tampoco se ejecutó la lista manual del informe 10 §5 | `05 §4` |
| 2 | Documentación de diseño desactualizada | ERD v3, CU, ADR y anteproyecto como fuente de verdad | D7…D28 solo en `CLAUDE.md`, commits y código; D25 ya está en `CLAUDE.md`. Backlog v3 con estados del 16/09; `INCONSISTENCIAS.md` y `TRAZABILIDAD.md` sin actualizar; esta carpeta sin versionar | `01 §7`, `07 §4` |
| 3 | Promesas del anteproyecto no implementadas | Descuento automático de insumos, producción diaria, escaneo con cámara, cambios de moneda, márgenes por producto, dashboard de caja, análisis multimodal en el cierre | NO o PARCIAL en todos los casos. El resumen del día ya muestra los tres medios de pago, pero el cierre sigue sin guardarlos ni mostrarlos | `08` |
| 4 | Sesión e inactividad (nuevo) | CU-17 y ADR-004: continuidad offline con una sesión validada | D27 cierra la sesión tras 30 min sin uso, solo con `navigator.onLine` y la cola vacía, sin perder datos. Con wifi sin internet o el servidor dormido, el usuario puede quedar sin poder volver a entrar (F-19). D27 no está en CU-17 | `03 §9` |
| 5 | Cierre de caja | CU-15/R-22/R-25: el servidor rechaza con cola pendiente; `MOVIMIENTO_EN_PERIODO_CERRADO`; totales por medio de pago | E-05 lo controla solo el frontend; R-25 reemplazado por D14/D18. Desde A5 hay vista previa del servidor (D28), cierres anteriores y fecha de Bogotá. Los totales por medio de pago no se guardan ni se muestran en la pestaña (F-21) | `02a §3.1`, `02b §6.6`, `04a P-13` |
| 6 | Operación offline en la interfaz | ERD §9.1, HU-030 (todas las operaciones núcleo offline) | Mapa de mesas (F-1) y precio del dispositivo (F-9) corregidos. Sigue faltando el catálogo sin conexión (F-2) | `03 §7-8` |
| 7 | Compatibilidad de navegadores | Chrome 70+, Firefox 67+, Safari/iOS 11.3+, Android 5.0+ | Chrome/Edge 111+, Firefox 114+, Safari/iOS 16.4+, HTTPS obligatorio | `03 §13` |
| 8 | Inicio / dashboard (wireframe 2) | KPI del día, mesas ocupadas con tiempo y total, novedades pendientes, resumen financiero ADMIN | Solo saludo, indicador de conexión y accesos rápidos | `04a P-03` |
| 9 | Modelo de datos vs ERD v3 | Enums con CHECK; `estado_pago` con 2 valores; `dispositivo_id` NOT NULL; pagos true/true/true | Sin cambios desde el 02/10: solo `rol` tiene CHECK; se agregaron `ANULADO`, `motivo_anulacion`, `origen` y `status_code_original`; `dispositivo_id` nullable; los pagos nacen solo con efectivo | `02a §2.18` |
| 10 | Contrato API v2 | Respuestas y códigos de §7–§14 | Endpoints extra (D13, D15, **D28**, health); `fecha_cliente` obligatoria en sync; `saldo_pendiente` y `details` de stock como texto; códigos nuevos; edición en línea de catálogo y mesas no idempotente | `02a §3.1-3.2` |
| 11 | Interfaz de mesa y navegación | CU-02: «Nueva sesión» abre la venta al elegir la mesa; wireframes con secciones separadas | D26: la cuenta se abre al agregar el primer producto, ahora desde una bandeja («Agregar a la mesa»). Ingreso de mercancía dentro de Inventario y cierre como pestaña de Caja (E-13, E-18). En pantalla se habla de «cuenta» y no de «sesión» | `03 §2-3`, `03 §10-12` |
| 12 | Requerimientos | El objetivo específico 1 pide un documento de RF/RNF | No existe | `07 §5` |

Ya no son divergencias (corregidas el 03/10): identidad de la PWA (ícono, título, idioma, `/admin/` interceptado) y formato de montos y fechas. Ver `03 §15`.

---

## 3. Preguntas abiertas para el equipo

1. ¿Cuál es la URL pública en Render y está funcionando hoy? `origin/main` ya incluye B1: ¿está definida `SECRET_KEY` en Render? Sin ella, el servicio no arranca. ¿Qué versión de PostgreSQL usa Neon?
2. ¿Se hizo la validación con Aroma & Co. (HU-037/038)? Fechas, participantes, dispositivos, formatos, actas o resultados.
3. ¿De dónde salieron los lotes de corrección E-01…E-19 (pruebas internas o retroalimentación de usuarios)?
4. ¿Dónde están las imágenes de los wireframes y los mockups de Figma (enlace) mencionados en HU-004?
5. ¿Existe el tablero de Jira de HU-007? ¿Se puede exportar para la monografía?
6. ¿Cómo se refleja la contribución de Esteban Garzón Delgado? En git solo aparece Daniel Gil (61 commits).
7. ¿Cómo se declarará en la monografía el uso de Claude Code como coautor (59 de 61 commits)?
8. ¿Existe un documento de requerimientos RF/RNF fuera del repo (objetivo específico 1, VAC-05)?
9. ¿Se decidió con el director el tema del calendario (12 semanas del anteproyecto vs. 9 del backlog)?
10. ¿Se corregirá F-2 (catálogo offline) antes de la entrega, o se documentará como limitación?
11. ¿Se probó el modo offline y la instalación en un dispositivo real (Android/iOS)? ¿Cuál será el equipo autorizado en Aroma & Co. y con qué navegador?
12. ¿Se actualizarán ERD, CU, ADR y anteproyecto (HU-047/HU-006), incluidas D27 (CU-17) y D28 (Contrato §11, CU-15), o las desviaciones se documentarán solo en la monografía?
13. ¿Se usará el admin de Django en producción? Ya no lo bloquea el service worker, pero solo registra `MovimientoCaja` y `CierreCaja` y requiere un superusuario que la app no crea.
14. ¿`INFORME_ESTADO_SPRINT3.md` y esta carpeta (`docs/insumos_documentacion/`, no versionada) deben entrar al repo como evidencia?
15. ¿Se confirmó que el health check de Render pasa con `SECURE_SSL_REDIRECT=True`?
16. ¿Qué cifras deben usarse en la monografía para «puntos completados» por sprint, dado que el backlog v3 no se actualizó después del 16/09?
17. **D27 frente a la continuidad offline (F-19):** ¿se acepta el riesgo de que el cierre por inactividad deje al operador sin poder volver a entrar cuando el wifi no tiene internet o Render está dormido? ¿O la condición debería comprobar que el servidor responde y guardar la última actividad entre aperturas (F-20)? Análisis completo en `03 §9`.
18. ¿Debe la pestaña «Cierre» mostrar (y `CierreCaja` guardar) los totales por medio de pago que la vista previa ya calcula (F-21, CU-15)?

---

## Cambios respecto a la versión del 02/10

- Encabezado y §1: commit `7326a5a`; endpoint D28; lista de cambios de interfaz y calidad; 194 + 38 pruebas verificadas hoy; 61 commits.
- §2: nueva divergencia sobre sesión e inactividad (D27, F-19). Se actualizan la del cierre (D28, F-21), la offline (solo queda F-2), la del Contrato (D28) y la de interfaz (bandeja, Inventario, Caja, «cuenta»). Salen identidad de la PWA y formato de datos, que ya se corrigieron.
- §3: preguntas actualizadas (SECRET_KEY en Render, conteos de commits, F-2, D27/D28 en HU-047, admin) y nuevas preguntas 17 (D27 frente a la continuidad offline) y 18 (totales por medio de pago).
