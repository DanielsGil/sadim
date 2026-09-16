---
paths:
  - "frontend/**"
  - "**/*.tsx"
  - "**/*.ts"
---

# Reglas del cliente PWA (ADR-003, ADR-004)

- TypeScript estricto. Tipos de dominio con los mismos nombres de campos que el ERD y el Contrato (`saldo_pendiente`, no `pendingBalance`).
- El cliente NUNCA calcula valores de negocio definitivos (stock, caja, saldos, totales de cierre). Puede mostrar estimaciones locales marcadas como "pendiente de sincronizar" y siempre las reemplaza por lo que responda el servidor.
- IDs de entidades creadas offline y `operation_id` se generan en el cliente con `crypto.randomUUID()`.
- Ocultar acciones por rol o por módulo desactivado es solo experiencia de usuario; la seguridad está en el backend.
- Persistencia local: IndexedDB (decisión cerrada). Introducir un wrapper (p. ej. Dexie) está abierto (INC-13): consultar antes.
- Pagos TRANSFERENCIA/QR sin conexión: nunca mostrarlos como confirmados.
- Diseño responsive: debe usarse en celular de gama baja y en escritorio.
