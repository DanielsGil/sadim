---
description: Audita en modo solo lectura lo construido en Sprint 1 y 2 (HU-001 a HU-012) contra ERD, Contrato API, ADR y Casos de Uso de SADIM, y genera un informe con veredicto por historia. Úsalo al empezar a trabajar en este repositorio.
disable-model-invocation: true
---

# Auditoría del Sprint 2 (solo lectura)

Objetivo: verificar que lo construido sigue el orden planteado, es coherente con los documentos aprobados y está listo para el Sprint 3.

**Prohibido en esta auditoría:** modificar código, crear migraciones, ejecutar `migrate`, instalar dependencias o hacer commits. Solo lees, ejecutas comandos de verificación y escribes UN archivo: el informe.

Lee primero `docs/INCONSISTENCIAS.md` y `docs/TRAZABILIDAD.md`. Puedes delegar la comparación campo a campo al subagente `revisor-consistencia`.

## Paso 1 — Reconocimiento
1. Mapea la estructura del repo: carpetas de backend y frontend, apps Django, `settings`, `requirements`/`pyproject`, `package.json`, docs existentes.
2. Detecta cómo se ejecuta cada parte (servidor, pruebas, migraciones, lint, tipos). Prepara una propuesta para la sección "Comandos del proyecto" de `CLAUDE.md` (no la escribas todavía).
3. Si existen documentos de arquitectura propios del repo (p. ej. `docs/architecture/`), compáralos con `docs/referencia/` y reporta diferencias.

## Paso 2 — Veredicto por historia
Para cada HU: ✅ Cumple · ⚠️ Parcial · ❌ No cumple · ❓ No verificable. Siempre con evidencia `archivo:línea` y cita del documento de referencia.

- **HU-007 Repositorio y estructura:** Django + DRF; React + TypeScript (Vite); README; organización por módulos Ventas / Inventario / Servicios / Finanzas (ADR-002); separación entre API, servicios y persistencia. PostgreSQL configurado (SQLite no debe ser el motor por defecto fuera de pruebas). Sin secretos commiteados.
- **HU-010 Modelos:** compara campo por campo contra ERD §4 cada modelo existente (mínimo Usuario, Categoria, Producto). Revisa UUID PK, `operation_id`, valores ENUM exactos, `DecimalField(10,2)`, constraints. Revisa específicamente INC-01, INC-02, INC-03, INC-04, INC-05 e INC-08: indica si el código copió el error del ERD, lo corrigió por su cuenta, o aún no aplica. ¿Existen ConfiguracionModulo y Mesa? (INC-10: aclarar qué significaba "Inventario").
- **HU-008 Login:** `/api/auth/login/`, `/api/auth/register/` (solo primer ADMIN), `/api/auth/refresh/` contra Contrato §3. Forma de la respuesta. Mensaje genérico ante credenciales inválidas (CU-17).
- **HU-009 RBAC:** lista TODOS los endpoints existentes con el rol que exige el código vs el rol del contrato. ¿La autorización está en permission classes del backend? ¿Hay pruebas que verifiquen 401 y 403?
- **HU-011 Catálogo:** `/api/categorias/` y `/api/productos/` con los métodos del contrato (sin DELETE; baja lógica con `activo`, INC-11). `stock_actual` no editable por el cliente. Filtros `categoria` y `tipo`.
- **HU-012 Consulta de catálogo:** GET accesible para OPERADOR; se pueden filtrar productos activos.
- **Transversales:** ¿el backend verifica módulo activo (ADR-006, VAC-02)? ¿Formato de error del Contrato §14? ¿Algún endpoint implementa idempotencia por `operation_id` (VAC-06)? ¿El frontend calcula algo que le corresponde al backend? ¿Hay pruebas automatizadas y pasan?
- **Sprint 1 (HU-001..006):** solo verifica que los documentos existan en el repo o en `docs/referencia/`. Para HU-004 (mockups) indica si hay evidencia. Para HU-006 recuerda INC-14.

## Paso 3 — Comandos de verificación
Si están disponibles, ejecuta: `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py showmigrations`, la suite de pruebas del backend, `npx tsc --noEmit` y el lint del frontend. Si alguno necesita configuración que no existe (BD, variables de entorno), no la inventes: repórtalo como hallazgo.

## Paso 4 — Preparación para Sprint 3
Revisa HU-013..HU-023 y señala qué les falta a los cimientos actuales (servicios transaccionales, Mesa, Venta, MovimientoCaja, MovimientoInventario, `operation_id`, verificación de módulo) y qué entradas abiertas de `INCONSISTENCIAS.md` bloquean cada HU. Recuerda VAC-01: CU-09 no tiene HU.

## Paso 5 — Informe
Escribe `docs/auditorias/auditoria-sprint2-<AAAA-MM-DD>.md` con:
1. Resumen ejecutivo (máximo 6 líneas, lenguaje sencillo).
2. Tabla: HU → veredicto → evidencia → acción sugerida.
3. Desviaciones respecto a ERD / Contrato / ADR, citando el documento.
4. Riesgos para Sprint 3 ordenados por impacto.
5. Propuesta de la sección "Comandos del proyecto" para `CLAUDE.md`.
6. Preguntas que el equipo debe responder, cada una ligada a un INC/VAC cuando aplique.

Al final, muestra en el chat el resumen ejecutivo y las preguntas, explica los términos técnicos que aparezcan y espera instrucciones.
