---
description: Verifica que un cambio, diseño o propuesta de SADIM sea consistente con el ERD, el Contrato API, los ADR y los Casos de Uso. Úsalo antes de crear o modificar modelos, endpoints, serializers o permisos, y cuando el usuario pida revisar consistencia.
argument-hint: "[archivo, HU o descripción]"
---

Revisa $ARGUMENTS. Si no se indica nada, revisa el diff actual (`git diff` y `git diff --staged`).

Compara contra:
1. `docs/referencia/02_ERD.md` §4 y §5: nombres, tipos, nulabilidad, UNIQUE, CHECK, reglas de negocio.
2. `docs/referencia/05_Contrato_API.md`: ruta, método, rol requerido, campos de request y response, códigos y formato de error.
3. `docs/referencia/01_ADR_Arquitectura.md`: en especial ADR-004 (UUID, `operation_id`, idempotencia), ADR-005 (RBAC en backend), ADR-006 (módulo activo), ADR-007 (sin tenant), ADR-008 (MovimientoCaja).
4. El CU asociado en `docs/referencia/03_Casos_de_Uso.md`: flujos alternos y excepciones.
5. `docs/INCONSISTENCIAS.md`: decisiones registradas y entradas abiertas.

Devuelve una lista de hallazgos con el formato:
`[Bloqueante | Importante | Menor] — qué dice el documento (archivo §sección) — qué hace el código (archivo:línea) — opciones de corrección`.

No corrijas nada automáticamente. Si no hay hallazgos, dilo explícitamente e indica qué revisaste.
