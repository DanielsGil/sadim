# SADIM — Frontend (PWA)

Aplicación web progresiva de SADIM hecha con React 19, TypeScript y Vite. Funciona sin conexión gracias a un service worker (`vite-plugin-pwa`) y a IndexedDB (Dexie), donde se guardan la sesión, la copia del catálogo y la cola de sincronización.

- `src/api/`: un módulo por recurso del Contrato API; todas las llamadas pasan por `api/cliente.ts`.
- `src/sync/`: enrutador de escrituras (en línea o cola), motor de sincronización y vistas locales provisionales.
- `src/paginas/` y `src/componentes/`: pantallas y componentes de la interfaz.

Comandos (desde esta carpeta): `npm run dev`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.

Instalación, arranque con el backend y despliegue: ver el [README.md de la raíz](../README.md).
