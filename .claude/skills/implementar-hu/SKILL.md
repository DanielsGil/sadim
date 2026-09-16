---
description: Flujo guiado para implementar una historia del backlog de SADIM con trazabilidad a su caso de uso, plan previo, pruebas y revisión de consistencia.
disable-model-invocation: true
argument-hint: <HU-XXX>
---

# Implementar $ARGUMENTS

1. **Ubicar.** Busca $ARGUMENTS en `docs/referencia/Backlog_Definitivo.md` y en `docs/TRAZABILIDAD.md`. Si es funcional y no tiene CU-XX, detente y avisa. Si su sprint no es el actual o depende de HU no terminadas, avisa.
2. **Leer las fuentes.** El CU completo (flujo principal, alternos, postcondiciones, columna Conexión), las entidades del ERD involucradas (§4) y sus reglas (§5), y los endpoints del Contrato con sus roles y JSON.
3. **Revisar inconsistencias.** Si alguna entrada "Abierta" de `docs/INCONSISTENCIAS.md` afecta esta HU, preséntala con opciones y espera decisión antes de seguir.
4. **Plan.** Presenta: archivos a crear o modificar; reglas de negocio que cubrirás (citando CU y ERD §5); cómo se cumple cada criterio de aceptación; pruebas que escribirás; y una explicación sencilla de cualquier concepto nuevo (con un ejemplo de la cafetería). Espera aprobación.
5. **Implementar en pasos pequeños.** Lógica en servicios; permission classes para roles; verificación de módulo activo; `transaction.atomic()` cuando haya efectos múltiples; `operation_id` cuando la operación pueda originarse offline.
6. **Pruebas.** Camino feliz; excepciones del CU; 403 para el rol no autorizado; operación repetida con el mismo `operation_id` no duplica efectos (si aplica); módulo desactivado rechaza la operación.
7. **Verificar.** Ejecuta las pruebas y los chequeos del proyecto. Pide al subagente `revisor-consistencia` que revise el diff y atiende sus hallazgos bloqueantes.
8. **Cerrar.** Resume qué se hizo, criterio por criterio; qué quedó pendiente; y propone un mensaje de commit `tipo(modulo): descripción [HU-XXX][CU-XX]`. No hagas commit sin petición explícita.
