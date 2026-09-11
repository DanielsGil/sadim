**SADIM**

**Registro de Decisiones de Arquitectura (ADR)**

Sprint 1 — Diseño del sistema y arquitectura
Universidad Antonio Nariño — Ingeniería de Sistemas y Computación
Bogotá, Colombia

# 1. Propósito del documento

Un Registro de Decisiones de Arquitectura (Architecture Decision Record, ADR) formaliza, para cada decisión técnica relevante, el contexto que la motiva, la decisión adoptada, las alternativas consideradas y sus consecuencias. Este documento consolida las principales decisiones arquitectónicas adoptadas para SADIM, estableciendo una referencia técnica trazable para el diseño, implementación y evolución del sistema.

Las decisiones formalizadas corresponden al motor de base de datos, el estilo arquitectónico del backend, la plataforma de entrega, la estrategia offline-first y de sincronización, el control de acceso, la activación configurable de módulos, el alcance de una instalación individual y la trazabilidad financiera.

# 2. Resumen de decisiones

| ADR | Título | Estado |
| --- | --- | --- |
| ADR-001 | Uso de PostgreSQL como motor de base de datos relacional | Aceptado |
| ADR-002 | Arquitectura de monolito modular configurable con Django REST Framework | Aceptado |
| ADR-003 | Progressive Web App (PWA) como plataforma de entrega | Aceptado |
| ADR-004 | Enfoque offline-first y estrategia de sincronización | Aceptado |
| ADR-005 | Control de Acceso Basado en Roles (RBAC) | Aceptado |
| ADR-006 | Activación configurable de módulos | Aceptado |
| ADR-007 | Instalación asociada a un único negocio | Aceptado |
| ADR-008 | Trazabilidad financiera mediante movimientos de caja | Aceptado |

# ADR-001 — PostgreSQL como motor de base de datos relacional

## Contexto

SADIM requiere persistencia relacional para representar ventas, órdenes de trabajo, inventario, usuarios y operaciones financieras, manteniendo integridad referencial y consistencia transaccional. El sistema requiere transacciones atómicas que permitan mantener la consistencia entre las operaciones de venta, inventario y finanzas. Una operación crítica debe confirmar sus cambios de manera conjunta o revertirlos en caso de fallo.

## Decisión

Se adopta PostgreSQL como sistema de gestión de base de datos relacional para los entornos de desarrollo, pruebas y producción del backend Django.

## Alternativas consideradas

- SQLite: se descarta como motor de producción; podrá utilizarse opcionalmente para pruebas locales cuando resulte conveniente.

- Firebase Firestore: se descarta como plataforma de persistencia para SADIM debido a que la arquitectura seleccionada requiere un modelo relacional y responsabilidades que ya son cubiertas por Django y PostgreSQL.

## Consecuencias

- Se requiere una instancia de PostgreSQL para los entornos donde se despliegue el backend.

- Se habilita el uso de transacciones y restricciones de integridad referencial a nivel de base de datos, reforzando la consistencia de las operaciones.

- El modelo de datos queda alineado con el ERD conceptual y lógico definido para el proyecto.

# ADR-002 — Monolito modular configurable con Django REST Framework

## Contexto

La lógica backend de SADIM se implementará mediante un monolito modular con Django REST Framework (DRF). El sistema requiere separar responsabilidades funcionales para facilitar mantenimiento, pruebas y evolución, manteniendo una implementación apropiada para el alcance del proyecto. Adicionalmente, SADIM debe permitir adaptar las funcionalidades disponibles según las necesidades del negocio mediante la activación o desactivación de módulos.

## Decisión

El backend se implementará como un monolito modular: un único servicio Django organizado en módulos funcionales independientes, expuestos mediante una API REST unificada con Django REST Framework. Los módulos principales serán Ventas, Inventario, Servicios y Finanzas. Cada módulo tendrá responsabilidades delimitadas y una estructura interna orientada a separar la exposición de la API, la lógica de aplicación, las reglas de negocio y la persistencia. La arquitectura seguirá principios de separación de responsabilidades inspirados en Clean Architecture, sin requerir una implementación estricta de dicho patrón.

## Alternativas consideradas

- Microservicios: se descartan por introducir complejidad de despliegue, comunicación y operación que no es necesaria para el alcance del proyecto.

- Monolito no modular: se descarta porque dificultaría la separación de responsabilidades y la evolución independiente de las funcionalidades.

## Consecuencias

- Un único despliegue simplifica la operación y reduce la complejidad de infraestructura.

- La separación modular permite desarrollar y probar funcionalidades de manera organizada sin introducir la complejidad de una arquitectura distribuida.

- Los módulos comparten la misma aplicación Django y la misma base de datos PostgreSQL, por lo que las operaciones que involucren varios módulos pueden mantener consistencia transaccional.

- La arquitectura permite incorporar nuevos módulos posteriormente sin convertir cada funcionalidad en un servicio independiente.

# ADR-003 — Progressive Web App (PWA) como plataforma de entrega

## Contexto

SADIM debe funcionar en dispositivos móviles y de escritorio y mantener capacidades de operación en escenarios de conectividad inestable. La PWA permite distribuir el sistema mediante tecnologías web, ofrecer una interfaz adaptable y utilizar mecanismos de almacenamiento y ejecución local.

## Decisión

SADIM se implementará como una Progressive Web App utilizando React y TypeScript. La aplicación utilizará un Web App Manifest y un Service Worker, se diseñará de forma responsive y dispondrá de mecanismos de almacenamiento local mediante IndexedDB para soportar la estrategia offline-first definida en ADR-004. El despliegue productivo deberá utilizar HTTPS para las capacidades de la PWA que lo requieran.

## Alternativas consideradas

- Aplicación nativa: se descarta por aumentar el esfuerzo de desarrollo y mantenimiento en comparación con una PWA multiplataforma.

- Aplicación web exclusivamente online: se descarta porque no satisface el requerimiento de continuidad operativa ante conectividad inestable.

## Consecuencias

- Se requiere mantener un Service Worker y una estrategia de almacenamiento local correctamente sincronizada.

- La interfaz debe adaptarse a los dispositivos objetivo.

- El funcionamiento offline queda condicionado por las capacidades de almacenamiento y ejecución disponibles en el navegador.

# ADR-004 — Enfoque offline-first y estrategia de sincronización

## Contexto

SADIM requiere continuidad operativa ante conectividad inestable. Las operaciones transaccionales incluyen ventas, abonos, consumos, movimientos de inventario y operaciones de caja, por lo que la sincronización debe evitar duplicaciones y preservar la consistencia.

## Decisión

SADIM adoptará un enfoque offline-first en el cliente PWA. La información y las operaciones que puedan ejecutarse localmente se almacenarán inicialmente en IndexedDB. Las operaciones realizadas sin conexión se registrarán en una cola local de sincronización y recibirán un identificador único de operación (operation_id). Cuando se recupere la conectividad, el cliente enviará las operaciones pendientes al backend mediante la API REST. El backend validará cada operación y utilizará el identificador de operación para garantizar un procesamiento idempotente, evitando que una misma operación sea aplicada más de una vez. La resolución de conflictos no utilizará una política global de “última escritura gana” para las operaciones transaccionales; estas deberán validarse de acuerdo con sus reglas de negocio antes de ser aceptadas por el servidor.

## Alternativas consideradas

- Arquitectura exclusivamente online: se descarta porque no garantiza continuidad operativa ante pérdida temporal de conectividad.

- CRDT: se descarta por exceder el alcance técnico del proyecto.

- Last Write Wins como estrategia global: se descarta para operaciones transaccionales porque puede producir resultados incorrectos ante operaciones concurrentes offline.

## Consecuencias

- Las operaciones que puedan crearse sin conexión requieren identificadores únicos generados localmente.

- El cliente debe mantener una cola de operaciones pendientes de sincronización.

- El backend debe ser capaz de reconocer operaciones previamente procesadas.

- Las operaciones transaccionales serán validadas antes de aplicarse definitivamente.

- Los pagos electrónicos requieren conectividad para confirmar su estado; los registros de operaciones en efectivo pueden almacenarse offline y sincronizarse posteriormente.

- La persistencia local depende de las capacidades de almacenamiento del navegador y debe contemplarse la posibilidad de pérdida de datos locales en escenarios no soportados por el navegador.

# ADR-005 — Control de Acceso Basado en Roles (RBAC)

## Contexto

SADIM requiere diferenciar las capacidades de administración del sistema de las operaciones cotidianas realizadas por los operadores. El control de acceso debe aplicarse de forma consistente en la interfaz y en la API.

## Decisión

Se implementará RBAC con dos roles definidos para el alcance del proyecto: Administrador y Operador. El Administrador tendrá acceso a la gestión del catálogo, precios, márgenes, análisis financiero, cierre de caja y ajustes maestros de inventario. El Operador tendrá acceso a las operaciones autorizadas de ventas, sesiones dinámicas y registro de abonos, sin acceso a información financiera sensible. El control de autorización se aplicará tanto en la interfaz como en la API. La interfaz ocultará acciones no autorizadas para mejorar la experiencia de usuario, mientras que el backend constituirá la capa definitiva de autorización.

## Alternativas consideradas

- Autorización únicamente en frontend: se descarta porque ocultar una funcionalidad no constituye una medida de seguridad suficiente.

- Control de acceso sin roles: se descarta porque no permite diferenciar las responsabilidades requeridas por el sistema.

## Consecuencias

- El backend debe validar permisos en cada operación protegida.

- El frontend debe reflejar los permisos para evitar mostrar acciones que el usuario no puede ejecutar.

- La estructura de permisos podrá ampliarse posteriormente si el alcance del producto incorpora nuevos roles.

# ADR-006 — Activación configurable de módulos

## Contexto

SADIM busca proporcionar una solución modular y adaptable a diferentes dinámicas de micro-comercios. Para permitir que una instalación utilice únicamente las funcionalidades necesarias, se requiere controlar la disponibilidad de los módulos sin modificar ni desplegar nuevamente el código de la aplicación.

## Decisión

Los módulos funcionales de SADIM permanecerán implementados dentro del monolito modular, pero su disponibilidad será controlada mediante configuración. Los módulos principales serán Ventas, Inventario, Servicios y Finanzas. La configuración corresponderá a cada instalación de SADIM, la cual administrará un único negocio. Cuando un módulo se encuentre desactivado, sus funcionalidades no se mostrarán en la interfaz y sus operaciones correspondientes serán rechazadas por el backend. No se realizará carga o descarga dinámica del código del módulo.

## Alternativas consideradas

- Carga dinámica de módulos o plugins: se descarta por introducir complejidad técnica innecesaria para el alcance.

- Eliminar módulos del código cuando estén desactivados: se descarta porque la activación es una configuración funcional y no una modificación del software desplegado.

## Consecuencias

- SADIM puede adaptarse a diferentes necesidades sin modificar su arquitectura base.

- El frontend y el backend deben respetar de manera consistente el estado de activación de cada módulo.

- Las pruebas deben contemplar tanto módulos activos como módulos desactivados.

- Las dependencias entre módulos deberán definirse en el diseño detallado.

# ADR-007 — Instalación asociada a un único negocio

## Contexto

El alcance del proyecto se orienta a la implementación de SADIM en un micro-comercio individual. La arquitectura no contempla actualmente la administración simultánea de múltiples negocios o sucursales dentro de una misma instalación.

## Decisión

Cada instalación de SADIM administrará un único negocio. No se implementará un modelo multi-tenant ni una separación de datos entre múltiples negocios dentro de la misma instancia para el alcance del proyecto. La configuración de módulos, usuarios, productos, ventas, órdenes, inventario y movimientos financieros corresponderá exclusivamente al negocio asociado a la instalación.

## Alternativas consideradas

- Multi-tenancy: se descarta por incrementar la complejidad del modelo de datos, autorización, aislamiento y sincronización sin ser necesario para el alcance actual.

- Gestión centralizada de múltiples sucursales: se descarta porque no forma parte del alcance actual.

## Consecuencias

- Se reduce la complejidad del modelo de datos.

- Se simplifica la autorización y el aislamiento de información.

- La configuración de módulos puede gestionarse a nivel de instalación.

- Una futura evolución hacia múltiples negocios requeriría revisar el modelo de datos y las reglas de autorización.

# ADR-008 — Trazabilidad financiera mediante movimientos de caja

## Contexto

SADIM contempla control financiero básico y registro de gastos hormiga. Para mantener trazabilidad, los ingresos y egresos deben poder relacionarse con las operaciones que los originan.

## Decisión

SADIM utilizará un registro de movimientos de caja como mecanismo central de trazabilidad de las operaciones económicas. Los movimientos podrán originarse, según el flujo correspondiente, en ventas, abonos de órdenes de trabajo y gastos o casos extras. El cierre de caja funcionará como un resumen o corte de los movimientos registrados durante un período determinado y no como la única fuente histórica de las operaciones financieras.

## Alternativas consideradas

- Registrar únicamente totales en CierreCaja: se descarta porque no permite reconstruir adecuadamente el origen de los valores.

- Mantener registros financieros independientes sin un movimiento común: se descarta porque dificulta la trazabilidad y consolidación.

## Consecuencias

- Se mejora la trazabilidad de ingresos y egresos.

- Los totales de caja pueden reconstruirse a partir de los movimientos registrados.

- Se facilita el control de gastos hormiga.

- Las operaciones financieras quedan mejor relacionadas con ventas, órdenes de trabajo e inventario.

# 3. Principios derivados de las decisiones

- La arquitectura prioriza simplicidad operativa y mantenibilidad para el alcance del proyecto.

- Las decisiones de arquitectura deben mantenerse alineadas con el modelo de datos, los casos de uso, el contrato de API y la interfaz.

- Las operaciones transaccionales deben preservar consistencia incluso cuando se originan sin conexión.

- La seguridad efectiva se aplica en el backend, mientras que el frontend refleja los permisos para mejorar la experiencia de usuario.

- La modularidad se logra mediante separación de responsabilidades y configuración funcional, no mediante microservicios ni carga dinámica de código.

# 4. Decisiones de diseño derivadas

Las decisiones específicas del modelo de datos y de los contratos de integración se documentarán en los artefactos correspondientes. Entre ellas se encuentran la representación de múltiples abonos por orden, la gestión de mesas, el registro de consumos asociados a órdenes de servicio, el control del stock mínimo y las estructuras de sincronización. Estas decisiones deben ser coherentes con los ADR anteriores, pero no constituyen ADR independientes salvo que posteriormente se identifique una decisión arquitectónica de mayor alcance.

# 5. Referencia de tecnologías

| Capa | Tecnología | Propósito |
| --- | --- | --- |
| Frontend | React + TypeScript | Interfaz de usuario de la PWA |
| PWA | Service Worker + Web App Manifest | Instalación, cache y capacidades offline |
| Persistencia local | IndexedDB | Datos y operaciones locales |
| Backend | Python + Django + Django REST Framework | API y lógica del sistema |
| Base de datos | PostgreSQL | Persistencia relacional |
| Control de versiones | Git + GitHub | Gestión del código fuente |