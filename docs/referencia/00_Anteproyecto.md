SADIM: Sistema modular de gestión basado en sesiones dinámicas para micro-comercios y negocios de Servicios

**Esteban Garzon Delgado**

11162213817

**Daniel Gil Moreira**

11162214717

**Universidad Antonio Nariño**

Programa Ingeniería de Sistemas y Computación

Facultad de Ingeniería de Sistemas

Bogotá, Colombia

2026

SADIM: Sistema modular de gestión basado en sesiones dinámicas para micro-comercios y negocios de Servicios

**Esteban Garzon Delgado**

11162213817

**Daniel Gil Moreira**

11162214717

Proyecto de grado presentado como requisito parcial para optar al título de:

**Ingeniero de sistemas y computación.**

**Director (a):**

Lucano Alberto Tafur Sequera

**Línea de Investigación:**

Innovación

**Universidad Antonio Nariño**

Programa Ingeniería de Sistemas y Computación

Facultad de Ingeniería de Sistemas

Bogotá, Colombia

2026

**Resumen**

El presente trabajo de grado tiene como objetivo el diseño y desarrollo de una aplicación web progresiva (PWA) orientada a mejorar la gestión operativa de micro-comercios y pequeños negocios de servicios en Colombia. A partir de la identificación de problemáticas relacionadas con la informalidad, la baja adopción tecnológica y el uso predominante de registros manuales, se propone una solución digital accesible, modular y adaptable a distintos tipos de negocio.

La aplicación integra funcionalidades para el registro de ventas, gestión de órdenes de trabajo, control de inventario y seguimiento financiero básico, permitiendo mejorar la organización de las actividades comerciales y la trazabilidad de los procesos. Su enfoque modular facilita la adaptación a diferentes dinámicas operativas, incluyendo el manejo de cuentas abiertas y procesos de servicio estructurados.

El desarrollo del proyecto se realiza bajo la metodología ágil Scrum, permitiendo una construcción iterativa e incremental del sistema a lo largo de cuatro sprints. Como resultado, se obtiene un prototipo funcional que será validado en un entorno real de uso, con el fin de evidenciar su utilidad en la optimización de procesos administrativos en micro-negocios.

***Palabras claves: ****Aplicación web progresiva (PWA), micro-comercios, gestión operativa, digitalización, inventario, Scrum.*

**Abstract**

This undergraduate thesis aims to design and develop a Progressive Web App (PWA) focused on improving the operational management of micro-businesses and small service-oriented enterprises in Colombia. Based on the identification of issues related to informality, low technological adoption, and the predominant use of manual record-keeping, an accessible, modular, and adaptable digital solution is proposed.

The application integrates functionalities for sales registration, work order management, inventory control, and basic financial tracking, enabling better organization of commercial activities and improved process traceability. Its modular approach allows adaptation to different business dynamics, including the management of open accounts and structured service processes.

The project is developed using the Scrum agile methodology, allowing an iterative and incremental construction of the system across four sprints. As a result, a functional prototype is obtained, which will be validated in a real-world environment to demonstrate its effectiveness in optimizing administrative processes in micro-businesses.

***Keywords: ****Progressive Web App (PWA), small businesses, operational management, digitization, inventory, Scrum.*

**Introducción**

En la actualidad, los micro-comercios y pequeños negocios de servicios en Colombia enfrentan dificultades en la gestión de sus operaciones diarias, especialmente en el control de ventas, inventarios y flujo de caja. A pesar del avance de la digitalización, muchos de estos establecimientos continúan utilizando métodos manuales, lo que genera errores, pérdida de trazabilidad y limitaciones en la toma de decisiones.

Esta situación está asociada a factores como la informalidad empresarial, la falta de acceso a herramientas tecnológicas adecuadas y la complejidad de las soluciones existentes, las cuales no siempre responden a las necesidades reales de estos negocios. En este contexto, surge la necesidad de desarrollar alternativas tecnológicas accesibles, de bajo costo y fáciles de usar.

En respuesta, el presente proyecto propone el desarrollo de una aplicación web progresiva (PWA) orientada a la gestión operativa de micro-comercios, integrando funcionalidades como el registro de ventas, la gestión de órdenes de trabajo, el control de inventario y el seguimiento financiero básico. Para su desarrollo, se emplea la metodología ágil Scrum, lo que permite una construcción iterativa del sistema y una evaluación constante de los avances.

# **1.   Planteamiento Problema**

## **1.1 Descripción Del Problema**

En la actualidad, las MiPyME (Micro, Pequeñas y Medianas Empresas) en Colombia atraviesan un proceso progresivo de digitalización, en el cual han comenzado a incorporar herramientas tecnológicas en sus operaciones con el objetivo de mejorar la gestión de sus actividades comerciales. Sin embargo, a pesar de estos avances, aún persisten importantes dificultades relacionadas con la administración y el control de la información financiera dentro de muchos pequeños negocios.

Según una encuesta realizada en 2025, más del 60 % de los empresarios participantes no llevaba registros financieros formales, lo que evidencia una debilidad significativa en la gestión administrativa de estos negocios. Además, el 39 % de los encuestados manifestó no tener ningún tipo de control sobre sus cuentas, mientras que aproximadamente un 30 % afirmó llevar algún registro de ingresos y gastos, aunque sin una metodología constante o disciplinada. En algunos casos incluso se reportó la mezcla entre el dinero personal y el del negocio, lo que genera mayores dificultades para la gestión financiera y reduce la claridad sobre el origen y destino de los recursos económicos (Gómez, 2025).

De manera similar, informes de la Cámara Colombiana de Comercio Electrónico señalan que una parte significativa de las micro y pequeñas empresas en el país aún presenta bajos niveles de transformación digital, particularmente en la adopción de herramientas tecnológicas para la gestión administrativa y operativa. Aunque la digitalización representa una oportunidad para mejorar la productividad, competitividad y organización interna de los negocios, persisten barreras importantes como la falta de conocimiento tecnológico, recursos económicos limitados y ausencia de estrategias claras para la implementación de soluciones digitales. Como consecuencia, se genera una brecha entre la disponibilidad de herramientas tecnológicas y su uso real en la operación diaria de los negocios, lo que afecta el control financiero y la eficiencia de los procesos internos (Cámara Colombiana de Comercio Electrónico, 2023).

En este contexto, resulta importante considerar que una gran parte de la actividad económica del país se desarrolla dentro de la economía informal, la cual suele ser menos visible en los estudios de digitalización empresarial. Según el informe Nueva evidencia sobre la informalidad laboral y empresarial en Colombia, publicado por el Banco de la República, la informalidad empresarial representa entre un tercio y dos tercios de la actividad económica, esto dependiendo del criterio empleado para hacer dicha evaluación. Teniendo esto en cuenta en un estudio realizado por Misión de Empleo (2022), se encontró que el 82% de las empresas en Colombia empleando como criterio el registro de la empresa ante la cámara de comercio. Dicho estudio, aunque pudo complementarse teniendo en cuenta más criterios, evidencia un muy alto índice de empresas informales en el país (Otero et al., 2025, p.17).

Dentro de esta economía informal se encuentran numerosos pequeños comercios y prestadores de servicios de barrio, como fruvers, papelerías, carnicerías, modisterías, cafeterías, entre otros, que desarrollan sus actividades sin contar con herramientas tecnológicas adecuadas para registrar y gestionar sus operaciones diarias. Estos negocios requieren llevar control de ventas, ingresos, compras, pérdidas o inventarios, pero en muchos casos continúan utilizando registros manuales, cuadernos o métodos poco estructurados, los cuales resultan ineficientes y susceptibles a errores.

Además, el nivel de adopción de sistemas **planificación de recursos empresariales (ERP)** en las empresas aún es relativamente bajo, con un 57.6 %, de los cuales solo un 21.5 % considera importante el uso de estas tecnologías (Sarmiento Suárez et al., 2024), lo que dificulta aún más su implementación. Esto se debe, en parte, a que muchos negocios no perciben la necesidad de mejorar la gestión y organización de sus procesos administrativos, como el control de ventas y compras, lo cual limita su capacidad para identificar falencias dentro de la empresa o negocio.

Esta situación se ve agravada por factores como el costo de los sistemas comerciales existentes, la complejidad de su uso y la falta de soluciones tecnológicas adaptadas a las necesidades reales de estos pequeños negocios, lo que limita su adopción (Estrategia Nacional Digital de Colombia, p.39). Como consecuencia, muchos de estos establecimientos continúan operando con procesos administrativos poco organizados, dificultando el control de sus operaciones y la toma de decisiones dentro del negocio.

En conjunto, el problema central radica en la falta de herramientas tecnológicas accesibles que permitan a los pequeños comercios y prestadores de servicios gestionar de manera organizada sus operaciones diarias. La ausencia de soluciones digitales simples y adaptadas a las necesidades de estos negocios limita el registro adecuado de actividades como ventas, ingresos, compras o inventarios, lo que dificulta el control de la información y la toma de decisiones dentro del negocio.

Ante este contexto, se evidencia la necesidad de desarrollar una aplicación web accesible, de bajo costo y fácil de utilizar, que permita a los pequeños negocios registrar y organizar sus operaciones de manera más clara y estructurada. Una aplicación tipo **Progressive Web App (PWA)** orientada a la digitalización de procesos operativos básicos permitiría mejorar la organización y el seguimiento cotidiano de las actividades comerciales, ofreciendo una alternativa digital frente al uso de registros manuales o métodos poco estructurados.

Una herramienta de este tipo permitiría registrar información relevante sobre las operaciones del negocio, facilitando el control de aspectos como ventas, cuentas pendientes, órdenes de trabajo o movimientos básicos de inventario. De esta manera, se contribuiría a mejorar la organización de los procesos internos y la trazabilidad de las actividades comerciales. Además, al tratarse de una aplicación web progresiva, podría utilizarse desde distintos dispositivos sin requerir instalaciones complejas, favoreciendo su adopción por parte de usuarios con conocimientos tecnológicos básicos.

## **1.2 Formulación Problema**

A partir de la problemática identificada y considerando la necesidad de herramientas tecnológicas accesibles para pequeños negocios, se plantea la siguiente pregunta de investigación y la hipótesis que orientarán el desarrollo de la solución propuesta.

### **Pregunta:**

***¿Cómo el desarrollo de un sistema PWA modular, adaptable y de bajo costo permite optimizar la gestión operativa y la trazabilidad de procesos en micro-comercios y negocios de servicios, con recursos tecnológicos limitados?***

### **Hipótesis:**

***Una aplicación tipo PWA que integre módulos para la digitalización de procesos operativos en pequeños comercios y prestadores de servicios permitirá mejorar la organización, el registro de actividades y la trazabilidad de sus operaciones. Esta solución facilitará la gestión de ventas, cuentas abiertas, órdenes de trabajo e inventario, ofreciendo una alternativa digital accesible frente a los métodos manuales.***

## **1.3 Justificación**

El presente proyecto surge de la necesidad de cerrar la brecha digital en el sector de los micro-comercios en Colombia, tales como panaderías, lavanderías y fruvers. Estas unidades económicas representan una parte vital de la economía local; según el Departamento Administrativo Nacional de Estadística (DANE, 2024), los micro negocios generan una parte significativa del empleo en el país, pero operan bajo una alta vulnerabilidad administrativa.

A nivel social, los micro-comercios son el sustento de miles de familias colombianas. Sin embargo, la gestión manual de ventas e inventarios genera un desgaste operativo que limita el tiempo de calidad y la estabilidad de los propietarios. Al implementar una solución de software accesible, se promueve la alfabetización digital y la formalización de procesos en sectores tradicionalmente excluidos. Según el Ministerio de Tecnologías de la Información y las Comunicaciones (MinTIC, 2023), la dimensión de "Habilidades Digitales" sigue siendo uno de los mayores retos en la brecha digital del país, representando el 35,1% del índice. Por tanto, esta herramienta no solo mejora la calidad de vida al reducir el estrés por "descuadres" financieros, sino que fortalece el tejido empresarial del barrio al capacitar al comerciante en el uso de herramientas modernas.

El impacto económico es crítico. La falta de un control riguroso sobre los imprevistos y la rotación de inventario produce fugas de capital que estancan el crecimiento. Investigaciones de la Fundación WWB Colombia (2024) señalan que un porcentaje importante de emprendedores desconoce aspectos básicos de su negocio, cómo identificar los productos que mayor ganancia dejan o el costo exacto de producción.

- **Optimización de recursos: **El sistema permite un cálculo exacto de entradas y salidas, mitigando el impacto de los "gastos hormiga" —pequeñas cantidades de dinero que, al no ser presupuestadas, afectan la salud financiera (BBVA, 2024)— y evitando pérdidas por productos vencidos.

- **Rentabilidad: **Al diferenciar entre ventas diarias y flujos de servicio, el software facilita la toma de decisiones basada en datos y no en intuiciones, atacando la baja adopción tecnológica que limita la competitividad del sector.

Desde la perspectiva técnica, la innovación reside en el enfoque modular y adaptativo bajo una arquitectura **PWA**. Según Microsoft (2025), las PWA permiten cerrar la brecha entre la web y lo nativo, ofreciendo compatibilidad entre dispositivos y funcionamiento *offline*, lo cual es vital en contextos donde la conectividad puede ser inestable. A diferencia de los softwares contables rígidos, esta propuesta ofrece:

- **Versatilidad de flujo: **Integra modelos de venta inmediata y servicios con tiempos de entrega en una sola plataforma de bajo costo.

- **Gestión de estados dinámicos: **Resuelve el problema técnico de la concurrencia y el seguimiento de pedidos mediante la funcionalidad de "cuentas abiertas".

- **Sincronización continua: **Garantiza la actualización transversal del inventario mediante el uso de *Service Workers* y almacenamiento local (IndexedDB).

Como futuros ingenieros, este proyecto permite aplicar competencias integrales en el ciclo de vida de desarrollo de software. De acuerdo con el Consejo General de Colegios de Ingeniería en Informática (CCII, s.f.), el ingeniero debe tener la capacidad de diseñar soluciones que integren aspectos éticos, sociales y económicos. Este proyecto representa el reto de transformar procesos análogos caóticos en algoritmos lógicos y estructuras de datos eficientes, diseñando interfaces de usuario (UI) centradas en la usabilidad para usuarios no técnicos.

De no desarrollar este aplicativo PWA, los micro-comercios seguirán operando bajo el riesgo de la "quiebra silenciosa". La brecha de competitividad frente a las grandes cadenas aumentará, desplazando a los pequeños comerciantes que no logren dar el salto hacia la transformación digital (MinTIC, 2022).

## **1.4 Objetivos**

### **1.4.1  Objetivo General**

Desarrollar una aplicación web progresiva orientada a la gestión dinámica de los procesos operativos en pequeños comercios y negocios de servicios, que integre el registro de operaciones, el seguimiento de inventario y la gestión de servicios prestados, con el fin de mejorar la trazabilidad de la información, fortalecer la planificación y el reabastecimiento, y apoyar la toma de decisiones de los usuarios.

### **1.4.2  Objetivos Específicos**

- Identificar los requerimientos funcionales y no funcionales de la PWA, mediante el análisis de los procesos operativos de micro-comercios y las características de los usuarios, con el fin de establecer las bases técnicas y funcionales para el desarrollo del sistema.

- Diseñar la interfaz de usuario de la aplicación web progresiva mediante wireframes y mockups que representen la organización de las pantallas, los flujos de navegación y las interacciones del usuario, garantizando una experiencia clara, intuitiva y adaptable a diferentes dispositivos.

- Implementar el módulo de gestión de inventario que permita registrar productos, controlar el stock disponible y gestionar contingencias operativas como mermas, compras menores o productos regalados, con el fin de garantizar la trazabilidad y consistencia de la información del inventario.

- Establecer los módulos de ventas y flujo de entrega de servicios que permitan gestionar cuentas abiertas, registrar consumos en tiempo real y administrar servicios prestados a clientes, facilitando el seguimiento de pedidos, tiempos estimados y costos asociados.

- Realizar pruebas de integración y funcionamiento sobre los módulos desarrollados del sistema, con el propósito de verificar la correcta comunicación entre la interfaz de usuario, la lógica de negocio y la base de datos.

## **1.5 Alcances**

El proyecto consiste en el desarrollo de una **PWA** de arquitectura modular y jerarquizada, diseñada para la transformación digital de micro-comercios colombianos. Esta solución permite una transición eficiente de registros manuales a un sistema digital integrado, asegurando la integridad de los datos mediante un modelo de **Control de Acceso Basado en Roles (RBAC)**. De acuerdo con Pressman y Maxim (2020), la implementación de roles diferenciados es esencial para mitigar riesgos operativos y garantizar que las funciones críticas sean ejecutadas únicamente por personal autorizado. El alcance se detalla a través de tres ejes funcionales principales:

### **1.5.1 Caracterización del Usuario y Caso de Aplicación**

Con el fin de delimitar el desarrollo y validación del sistema, este proyecto toma como caso de aplicación ilustrativo una cafetería de barrio en Bogotá, denominada Aroma & Co., ubicada en la localidad de Chapinero. Este negocio fue seleccionado por representar de manera integral las tres dinámicas operativas contempladas en el alcance del sistema: ventas de consumo inmediato, servicios por encargo e inventario. Lo anterior permite formular requerimientos concretos, diseñar mockups contextualizados y estructurar pruebas de validación representativas, sin que ello implique restringir la aplicabilidad de SADIM a este tipo de negocio en particular, dado su enfoque modular y adaptable.

Perfil del negocio:

- **Tamaño: **micro-comercio con un (1) propietario, quien cumple el rol de Administrador, y un (1) empleado, quien cumple el rol de Operador.

- **Infraestructura: **seis (6) mesas para consumo en el local y un mostrador para venta rápida o para llevar.

- **Catálogo de productos: **bebidas calientes y frías (café, jugos, gaseosas), productos empacados (papas, dulces, mecato), panadería y pastelería (pan de queso, almojábanas, croissants) y sándwiches.

- **Dinámicas operativas identificadas:**

- *Consumo en mesa: *el cliente abre una sesión dinámica al sentarse, registra consumos progresivos de cualquier producto del catálogo y cancela el total al finalizar (Módulo 1).

- *Venta rápida de mostrador: *venta inmediata de un solo producto sin necesidad de abrir sesión (Módulo 1).

- *Pedidos de repostería por encargo: *solicitud de tortas o postres personalizados para eventos, con fecha de entrega, registro de abono y saldo pendiente (Módulo 2).

- *Gestión de inventario: *control diferenciado entre insumos de producción (harina, café, leche) y productos adquiridos para reventa directa (gaseosas, dulces empacados), ambos con descuento automático tras cada venta (Módulo 3).

- **Medios de pago aceptados: **efectivo, transferencia bancaria y código QR.

- **Roles: **Administrador (propietario: define catálogo, precios y márgenes; accede a análisis financiero y cierre de caja) y Operador (empleado: registra ventas, abre sesiones de mesa, gestiona abonos; sin acceso a información financiera sensible).

Este perfil de usuario corresponde al segmento de micro-comercios de subsistencia descrito en el planteamiento del problema (sección 1.1), caracterizado por la informalidad administrativa y la dependencia de registros manuales, lo que lo convierte en un caso representativo para validar la pertinencia de la solución propuesta.

### **1.5.2 Módulo 1: Gestión de Ventas Diarias y Consumo Inmediato**

Diseñado para negocios de alta rotación (panaderías, cafeterías, fruvers). Las funcionalidades se dividen según el nivel de responsabilidad:

- **Gestión Operativa (Ambos Roles): **Registro ágil de ventas, apertura y seguimiento de Sesiones Dinámicas (Cuentas Abiertas) para consumos progresivos, y el control de Casos Extras (compras hormiga y cambios de moneda) para asegurar que el dinero en caja sea exacto.

- **Gestión de Configuración (Solo Admin): **El Administrador posee la facultad exclusiva de realizar la Personalización del Catálogo, definiendo productos, categorías y, fundamentalmente, el establecimiento de precios y márgenes de ganancia. Asimismo, supervisa la lógica de producción diaria para evitar descuadres en el inventario de materia prima.

### **1.5.3 Módulo 2: Flujo de Entrega y Gestión de Servicios**

Orientado a negocios basados en órdenes de trabajo (lavanderías, talleres, relojerías).

- **Gestión Operativa (Ambos Roles): **Trazabilidad completa del servicio, desde el registro inicial del cliente y el estado del producto, hasta la asignación de fechas de entrega y el registro de abonos.

- **Gestión Financiera (Solo Admin): **El acceso a la herramienta de Análisis de Costos Operativos es restringido al Administrador. Esto le permite desglosar gastos en repuestos, herramientas y correcciones, facilitando el cálculo de la utilidad neta real por servicio sin que esta información sensible sea visible para el operador.

### **1.5.4 Módulo 3: Inventario Centralizado y Análisis Financiero**

Funciona como el núcleo inteligente del sistema, vinculando los ingresos con las existencias físicas.

- **Consultas y Movimientos (Ambos Roles): **Visualización del stock en tiempo real y registro de ingresos de mercancía estándar. El sistema garantiza la Actualización Sincronizada, ajustando el inventario automáticamente tras cada venta o servicio finalizado.

- **Auditoría y Cierre (Solo Admin): **El Administrador tiene la potestad de realizar ajustes manuales maestros al inventario (corrección de errores o mermas) y acceder al Análisis Multimodal de Pagos. Esta función consolida los ingresos por efectivo, QR y transferencias para realizar un arqueo de caja con rigor profesional.

### **1.5.5 Entregables**

- **Software PWA Funcional: **Aplicación web modular con tres núcleos:

- **Módulo de Ventas: **Interfaz para registro ágil y gestión de "cuentas abiertas".

- **Módulo de Órdenes de Trabajo: **Sistema de seguimiento de estados para servicios (recepción, proceso, entrega, abonos).

- **Módulo de Inventario: **Control de existencias con actualización automática transversal.

- **Núcleo Financiero Operativo: **Dashboard de flujo de caja diario (ingresos vs. gastos menores).

- **Documentación Técnica: **Documento de arquitectura, modelo de datos y especificación de requisitos.

### **1.5.6 No Entregables (Exclusiones)**

- **Contabilidad Formal: **No se generarán estados financieros bajo normas NIIF ni libros contables oficiales.

- **Facturación Electrónica: **El sistema no tendrá integración con el ecosistema de la DIAN para facturación electrónica certificada.

- **Gestión de Talento Humano: **No incluye módulos de nómina, prestaciones sociales o administración de turnos de personal.

- **Integraciones Bancarias: **No se realizarán conciliaciones bancarias automáticas ni pasarelas de pago externas.

## **1.6 Limitaciones**

Las limitaciones se definen como los factores técnicos y del entorno que condicionan el desarrollo y funcionamiento del software:

- **Cronograma de Ejecución: **El proyecto está sujeto a un tiempo límite de **12 semanas (3 meses)** para las fases de desarrollo, pruebas y validación.

- **Dependencia de Conectividad para Sincronización: **Bajo una arquitectura *offline-first*, las funciones núcleo (ventas, inventario y servicios) garantizan operatividad local sin internet. No obstante, la sincronización de datos, el respaldo en la nube y el análisis de métricas históricas quedan supeditados a la disponibilidad de una conexión estable.

### **1.6.1 Limitaciones de Software y Compatibilidad:**

La aplicación depende estrictamente del soporte de tecnologías modernas de Service Workers y bases de datos locales (IndexedDB). Por tanto, el funcionamiento está supeditado a:

- Navegadores: Versiones actualizadas de Google Chrome (v70+), Mozilla Firefox (v67+), Safari (v11.3+) o Microsoft Edge (v79+).

- Sistemas Operativos: Dispositivos móviles con Android 5.0 o superior, o iOS 11.3 o superior, para garantizar la instalación de la PWA y el acceso al almacenamiento local.

- Modo de Navegación: El sistema no garantiza el almacenamiento persistente si se ejecuta en "Modo Incógnito" o "Navegación Privada", dado que los navegadores restringen el acceso a IndexedDB en dichos estados.

### **1.6.2 Hardware y Rendimiento**

La operatividad óptima requiere un dispositivo con un mínimo de 2 GB de RAM (4 GB recomendados) y 100 MB de almacenamiento libre para la persistencia de datos locales. El sistema no incluye integración nativa (drivers) con periféricos industriales como básculas o cajones monederos; la interacción se limita a los componentes estándar del hardware (pantalla táctil, teclado y cámara para escaneo de códigos).

### **1.6.3 Escalabilidad y Volumen de Datos**

La arquitectura está optimizada exclusivamente para el flujo transaccional de micro-comercios. El diseño no contempla el procesamiento de Big Data, la gestión centralizada de múltiples sucursales o la alta concurrencia propia de grandes superficies de retail masivo, donde los requerimientos superarían la capacidad del modelo modular planteado.

# **2.   Marco de referencia**

## **2.1 Marco Teórico**

Este marco teórico integra el contexto socioeconómico de los micro-comercios con los fundamentos tecnológicos seleccionados, estableciendo el vínculo esencial entre la problemática detectada y la solución de ingeniería propuesta para una comprensión integral del proyecto. Adicionalmente, se incluyen algunos conceptos complementarios en la sección de anexos del documento (ver Anexo A, pág. 31).

### **2.1.1 Conceptos No Técnicos (Contexto de Negocio y Social)**

Estos términos definen el problema real y la lógica de operación de los micro-comercios:

*Tabla 1. Conceptos no técnicos*

| **Título** | **Definición** |
| --- | --- |
| **Micro-comercio de Subsistencia** | Unidades económicas de hasta nueve personas que generan ingresos para el sustento básico del propietario (DANE, 2023). |
| **Informalidad Administrativa** | Falta de procesos estandarizados y dependencia de registros manuales, lo que constituye la principal barrera para el crecimiento empresarial (Cámara de Comercio de Bogotá, 2022). |
| **Cuentas Abiertas (Consumo Diferido)** | Modelo de facturación diferida donde se registran consumos progresivos antes del pago final (Kotler & Armstrong, 2018). |
| **Gasto Hormiga** | Pequeñas salidas diarias de dinero no registradas que afectan negativamente el flujo de caja (Asobancaria, s.f.). |
| **Mermas y Desperdicios** | Pérdida de inventario no recuperable que impacta directamente el costo de ventas (Horngren, 2012). |
| **Órdenes de Trabajo (Servicios)** | Secuencia de estados (recibido, proceso, listo) dependientes de la información del cliente para la gestión de servicios (Chase & Jacobs, 2014). |
| **Cierre de Caja (Arqueo)** | Herramienta de control interno utilizada para validar la integridad del efectivo y los ingresos del día (Fierro Martínez, 2015). |

*Nota. Elaboración propia*

### **2.1.2 Conceptos Técnicos (Herramientas y Arquitectura)**

Presenta los pilares tecnológicos seleccionados para la construcción de la solución:

*Tabla 2. Conceptos técnicos*

| **Título** | **Definición** |
| --- | --- |
| **Backend con Python y Django** | Uso de un lenguaje eficiente y un framework que garantiza seguridad y un mapeo de datos (ORM) robusto (Vidal-Silva, 2021; Django Software Foundation, 2024). |
| **Arquitectura Modular** | Separación de preocupaciones basada en Clean Architecture para permitir escalabilidad y mantenimiento independiente de funciones (Martin, 2017). |
| **Base de Datos Relacional (PostgreSQL/SQLite)** | Aplicación de reglas de integridad referencial para evitar inconsistencias en el inventario y las finanzas (Codd, 1970). |
| **Metodología Scrum** | Marco de trabajo iterativo organizado en Sprints e Historias de Usuario para la entrega constante de valor funcional (Schwaber & Sutherland, 2020). |

*Nota. Elaboración propia*

### **2.1.3 Arquitectura y Stack Tecnológico**

Detalle técnico para garantizar escalabilidad y funcionamiento en baja conectividad:

- **Lógica Backend: **Implementación de un Monolito Modular con Django Rest Framework (DRF), utilizando clases abstractas para la activación dinámica de módulos según el perfil del negocio.

- **Capacidades PWA: **Uso de Service Workers para garantizar la operatividad *offline* e IndexedDB para la persistencia local de catálogos y precios, sincronizando datos al recuperar la conexión.

### **2.1.4 Fundamentos de Gestión Operativa**

Traducción de procesos de negocio a estructuras de datos:

- **Sesiones Dinámicas: **Gestión de estados para transacciones temporales acumulativas, calculando el total final únicamente al cierre del servicio o venta.

- **Balance de Masa en Inventario: **Algoritmo de descuento automático donde: Inventario_Final = Inventario_Inicial + Producción - Ventas.

- **Costeo por Órdenes: **Modelo que acumula costos de insumos, herramientas y mano de obra para determinar la utilidad neta real por cada trabajo entregado.

### **2.1.5 UX, Seguridad y Calidad (QA)**

Enfoque en usabilidad y fiabilidad técnica:

- **Diseño Centrado en el Usuario: **Aplicación de minimalismo cognitivo para reducir clics en el registro de ventas y centralizar la analítica en un *dashboard* unificado.

- **Integridad Transaccional: **Empleo de transacciones atómicas en la base de datos para asegurar que cada venta afecte el stock de forma irreversible, eliminando descuadres.

- **Validación de Caja Negra: **Pruebas funcionales con usuarios reales en entornos comerciales para verificar la resistencia del sistema y la trazabilidad de los gastos registrados.

## **2.2 Estado Del Arte**

Continuando con la problemática relacionada con la digitalización de microcomercios, existe una variedad de aplicaciones orientadas a la gestión de ventas e inventarios. Sin embargo, muchas de estas presentan limitaciones en distintos aspectos. Debido a ello, se realizó el análisis de algunas herramientas con el objetivo de identificar sus principales características y limitaciones.

### **Antecedentes académicos**

La problemática de la digitalización en micro y pequeñas empresas ha sido ampliamente documentada en la literatura reciente. Durán Mero (2025), en su revisión de 35 estudios sobre transformación digital en pymes ecuatorianas, identificó barreras estructurales recurrentes como la escasa capacitación tecnológica, las limitaciones financieras y la falta de infraestructura; así como factores impulsores entre los que destaca el liderazgo gerencial y el acceso creciente a tecnologías asequibles. El autor concluye que la adopción digital en estos contextos sigue siendo desigual, especialmente en sectores tradicionales, lo que subraya la necesidad de soluciones accesibles y de bajo costo adaptadas a las dinámicas locales.

En el contexto latinoamericano específicamente enfocado en micro y pequeñas empresas (mypes), Pichén Moreno (2025) realizó una revisión sistemática de 20 estudios del período 2021-2025, concluyendo que las empresas que adoptan herramientas de digitalización logran mejores operaciones y mayor competitividad, y que aquellas que no lo hacen enfrentan riesgo de cierre o estancamiento. El estudio destaca que la digitalización de procesos operativos —incluyendo bases de datos, gestión de inventario y selección adecuada de herramientas tecnológicas— es un factor crítico para la supervivencia de este tipo de unidades económicas.

Para el caso colombiano específicamente, Sarmiento Suárez et al. (2024) analizaron el grado de madurez digital de 3.708 MiPymes colombianas, encontrando que las microempresas presentan un nivel de madurez digital básico de 2.32 sobre 5, y un nivel avanzado de apenas 1.31 sobre 5. El estudio evidenció que, si bien el 57.6% de las empresas reporta usar algún sistema de gestión empresarial (ERP), solo el 21.5% lo considera realmente importante, lo que sugiere una adopción superficial o mal orientada. Las principales barreras identificadas fueron la conexión de banda ancha insuficiente, los altos costos de inversión y la escasez de recursos financieros, condiciones directamente presentes en los micro-comercios informales de ciudades como Bogotá.

En materia de sistemas de gestión empresarial para pymes, Muñoz Ruano et al. (s.f.) realizaron una revisión de literatura sobre sistemas ERP en pymes de América Latina, concluyendo que los sistemas propietarios presentan una brecha significativa entre su funcionalidad y los requisitos reales de las pequeñas empresas —lo que se conoce como "problema de desajuste"— y que la alternativa más conveniente para este segmento son los sistemas de código abierto gestionados en la nube, dado que reducen los costos de implementación hasta en un 95% frente a los sistemas tradicionales. Esta evidencia refuerza la pertinencia de propuestas como SADIM, que adopta una arquitectura modular y de bajo costo diseñada desde cero para las dinámicas de micro-comercios.

Finalmente, en el campo de la gestión de inventario digitalizada, Pinillos Aldoradin et al. (2024) revisaron 55 estudios sobre estrategias de gestión de inventario y optimización de stock, encontrando que la implementación de sistemas digitales mejora la precisión del inventario hasta en un 25%, y que la adopción de técnicas como el descuento automático de stock tras cada venta —base del Módulo 3 de SADIM— reduce los errores operativos y los costos asociados de forma significativa. El estudio también advierte que la resistencia al cambio y la falta de habilidades técnicas son los principales obstáculos para la adopción tecnológica en contextos con recursos limitados.

### **Herramientas existentes y análisis crítico**

A continuación se presentan las principales herramientas de gestión para micro-comercios identificadas en el mercado:

*Tabla 3. Aplicaciones de gestión para micro-comercios*

| **Título** | **Definición** |
| --- | --- |
| **Square POS** | Es una plataforma que permite el procesamiento de pagos, así como la gestión de ventas, inventarios y reportes, facilitando el registro y análisis de transacciones (Square Point of Sale, 2026). |
| **Odoo** | Sistema ERP que integra diferentes aplicaciones, como ventas, inventario y contabilidad, con el fin de automatizar procesos y centralizar la información (Odoo, s.f.). |
| **Alegra** | Es una plataforma orientada a la gestión administrativa y contable, que permite manejar procesos como la facturación y el control de ingresos, gastos e inventarios (Software de Gestión y Facturación para Contadores y Pymes, 2026). |
| **Treinta** | Esta aplicación dirigida a micro-negocios permite registrar ventas, controlar inventarios y gestionar ingresos y gastos (Whaticket, 2025). |

*Nota. Elaboración propia*

El análisis comparativo detallado (ver Anexo B) muestra que ninguna de las herramientas existentes combina simultáneamente los seis criterios evaluados. Odoo, siendo el sistema más completo en funcionalidades, está diseñado para empresas medianas con capacidad técnica y financiera para su implementación y mantenimiento, lo que lo hace inaccesible para micro-negocios informales. Square POS es accesible y enfocado en ventas, pero no contempla órdenes de trabajo ni cuentas abiertas progresivas, limitando su uso a transacciones inmediatas. Alegra está orientada a la contabilidad formal y facturación electrónica, un nivel de formalización que excede las necesidades y posibilidades de los micro-comercios de subsistencia descritos en la sección 1.1. Treinta, la más cercana al segmento objetivo, ofrece ventas e inventario básico con cuentas abiertas, pero carece del módulo de órdenes de trabajo necesario para negocios de servicios.

SADIM resuelve esta brecha al integrar los tres ejes funcionales (ventas con sesiones dinámicas, órdenes de servicio y gestión de inventario) en una sola plataforma PWA de bajo costo, sin requerir instalación local ni conocimientos técnicos avanzados, diseñada específicamente para las dinámicas operativas de micro-comercios colombianos, tomando como caso ilustrativo la Cafetería Aroma & Co. de Chapinero, Bogotá. Para complementar este análisis, se incluye una tabla comparativa en los anexos del documento (ver Anexo B, pág. 32).

## **2.3 Marco Legal**

El desarrollo e implementación de la solución propuesta se rige bajo el ordenamiento jurídico colombiano, abarcando normativas de protección de datos, tecnologías de la información, propiedad intelectual y estatutos del consumidor. Este marco garantiza que el software modular no solo sea eficiente técnicamente, sino legalmente viable en el entorno comercial nacional.

El detalle de las leyes y normativas aplicables se presenta en la sección de anexos del documento (ver Anexo C, pág. 33).

# **3.   Metodología**

Para el desarrollo de este proyecto se ha seleccionado la metodología Scrum, debido a su capacidad de adaptación y a su enfoque basado en entregas cortas que permiten un seguimiento constante del avance del sistema. Esta metodología facilita la evaluación continua de cada incremento funcional desarrollado, así como la incorporación de cambios durante el proceso, esto resulta especialmente conveniente en contextos donde pueden presentarse cambios en los requerimientos a lo largo del desarrollo.

## **3.1 Descripción de la metodología (scrum)**

Scrum se basa en un enfoque iterativo e incremental que permite el aprendizaje continuo y la mejora progresiva del proyecto, facilitando la identificación temprana de riesgos y promoviendo el trabajo colaborativo mediante roles definidos (Schwaber y Sutherland, 2020). Asimismo, establece la visibilidad y revisión constante de los procesos, permitiendo realizar ajustes oportunos y mantener una alta capacidad de adaptación, sustentada en sus pilares de transparencia, inspección y adaptación (Schwaber y Sutherland, 2020).

Para complementar la información presentada, se incluye una figura en la sección de anexos del documento (ver Anexo D, pág. 36).

### **3.1.1 Roles en scrum**

En Scrum se identifican tres roles fundamentales: Product Owner, Scrum Master y Developers, cada uno con responsabilidades específicas que contribuyen al desarrollo del proyecto (Amazon Web Services, 2026).

- El Product Owner orienta el trabajo del equipo, prioriza los requerimientos y garantiza el valor del producto según las necesidades del cliente (Amazon Web Services, 2026).

- El Scrum Master facilita la implementación de la metodología, coordina el proceso y apoya al equipo en la eliminación de obstáculos (Amazon Web Services, 2026).

- Los Developers son los encargados de construir el producto, trabajando de manera colaborativa para cumplir los objetivos del sprint (Amazon Web Services, 2026).

### **3.1.2 Eventos de scrum**

Esta metodología se compone de una serie de eventos que se desarrollan de manera cíclica a lo largo del proyecto, los cuales permiten planificar, ejecutar, evaluar y mejorar continuamente el proceso de desarrollo:

- **La Planificación del sprint (Sprint Planning): **Define el alcance, los objetivos y las tareas a desarrollar (Amazon Web Services, 2026).

- **Sprint: **Es el periodo en el que se construye un incremento funcional del producto (Amazon Web Services, 2026).

- **Reunión diaria de Scrum (Daily Scrum): **Permite comunicar avances y detectar dificultades (Amazon Web Services, 2026).

- **Revisión del sprint (Sprint Review): **Evalúa el incremento y permite recibir retroalimentación del Product Owner, cuyos hallazgos se incorporan al Product Backlog para el siguiente ciclo (Amazon Web Services, 2026).

- **Retrospectiva del sprint (Sprint Retrospective): **Analiza el proceso para identificar mejoras en los siguientes ciclos (Amazon Web Services, 2026).

### **3.1.3 Artefactos de scrum**

Los artefactos en Scrum permiten organizar y dar seguimiento al desarrollo del proyecto, garantizando la transparencia y la adaptación continua del producto.

- **Product Backlog: **Es una lista priorizada de tareas y requisitos, que se actualiza constantemente y es gestionada por el Product Owner (Amazon Web Services, 2026).

- **Sprint Backlog: **Corresponde a las tareas seleccionadas para un sprint, organizando el trabajo necesario para cumplir los objetivos (Amazon Web Services, 2026).

- **Incremento: **Es el resultado funcional obtenido al finalizar cada sprint, el cual debe estar en condiciones de ser revisado y probado por el Product Owner antes de iniciar el siguiente ciclo (Amazon Web Services, 2026).

## **3.2. Aplicación de la metodología (scrum)**

A partir de este punto se describe la aplicación de la metodología Scrum en el desarrollo de la PWA SADIM. Este enfoque permite realizar un seguimiento continuo del avance del proyecto, así como identificar riesgos y realizar ajustes oportunos durante el proceso. Para ello, el desarrollo se organiza en cuatro sprints de tres semanas cada uno, abarcando un total de doce semanas, en coherencia con el tiempo establecido para su ejecución.

### **3.2.1 Roles asignados**

De acuerdo con la dinámica de trabajo establecida en la metodología Scrum, se definieron los siguientes roles dentro del desarrollo del proyecto:

- Scrum Master: Lucano Alberto Tafur Sequeira, director del trabajo de grado.

- Product Owner: Esteban Garzón Delgado y Daniel Gil Moreira, estudiantes de Ingeniería de Sistemas y Computación.

- Developers: Esteban Garzón Delgado y Daniel Gil Moreira, estudiantes de Ingeniería de Sistemas y Computación.

### **3.2.2 Tareas y Entregables por Sprint**

La tabla de planificación de sprints se presenta en la sección de anexos del documento (ver Anexo E, pág. 37), donde se especifican los sprints definidos, las tareas asociadas y los entregables correspondientes.

# **4.   Cronograma**

El cronograma del proyecto SADIM, en el que se establecen las actividades necesarias para su desarrollo organizadas en cuatro sprints de tres semanas cada uno, para un total de doce semanas de ejecución, se presenta en la sección de anexos del documento (ver Anexo F, pág. 39).

# **5.   Costos**

El presente apartado describe la estimación de los costos asociados al desarrollo del proyecto SADIM, considerando los recursos humanos, tecnológicos y administrativos necesarios para su implementación. Estos costos se calcularon con base en el cronograma definido, el cual establece una duración de cuatro sprints a lo largo de doce semanas.

### **Justificación de costos**

**Recursos humanos:** La estimación de horas por desarrollador se derivó directamente del cronograma de ejecución: doce semanas con una dedicación promedio de cinco días por semana y cuatro horas diarias de trabajo efectivo destinadas al proyecto, lo que arroja un total de 240 horas por desarrollador (12 semanas × 5 días × 4 horas/día). Esta dedicación parcial refleja que ambos estudiantes cursan otras asignaturas de forma simultánea al desarrollo del trabajo de grado. La tarifa de $35.000 COP por hora corresponde al valor de referencia para un desarrollador junior de software en Colombia según el mercado laboral vigente (Computrabajo, 2025). Para el director del proyecto, se estimaron 48 horas totales distribuidas en reuniones de seguimiento y retroalimentación por sprint (aproximadamente 4 horas semanales), con una tarifa de $60.000 COP por hora acorde al perfil docente con título de posgrado. El costo del director es asumido por la Universidad Antonio Nariño como parte de la tutoría académica.

**Recursos tecnológicos:** Los equipos de cómputo (dos portátiles, valoradas en $3.500.000 COP cada una) son de propiedad de los desarrolladores y se incluyen en el presupuesto como costo de oportunidad, dado que constituyen el principal recurso físico utilizado durante todo el período de desarrollo. Las herramientas de software (frameworks de desarrollo, Visual Studio Code, Firebase) son de uso libre y gratuito, por lo que no generan costo de licencia.

**Recursos administrativos:** Los servicios de luz e internet se estimaron con base en el consumo mensual promedio del hogar de cada desarrollador durante los tres meses de ejecución del proyecto. El servicio de energía se estimó en $190.000 COP mensuales y el de internet en $210.000 COP mensuales, para un total de $800.000 COP que cubre los tres meses del período de desarrollo.

**Contingencias:** Se incluyó un porcentaje adicional del 10% sobre el costo base ($27.480.000 COP) para cubrir posibles imprevistos durante el desarrollo, tales como retrasos en la implementación, necesidad de herramientas adicionales o ajustes en el alcance derivados de la retroalimentación del director. Esto eleva el costo total estimado del proyecto a $30.228.000 COP.

Las tablas detalladas correspondientes a cada tipo de recurso se presentan en la sección de anexos del documento (ver Anexo G, pág. 41), donde se detallan los valores asociados a cada componente.

# **6.   Referencias Bibliográficas**

- Alegra. (2026). Software de gestión para contadores y pymes. https://www.alegra.com/colombia/

- Amazon Web Services. (2026). ¿En qué consiste Scrum? https://aws.amazon.com/es/what-is/scrum/

- BBVA. (2024, noviembre 22). Los "gastos hormiga" pueden afectar el ahorro más de lo que se cree. https://www.bbva.com/es/pe/salud-financiera/los-gastos-hormiga-pueden-afectar-el-ahorro-mas-de-lo-que-se-cree/

- Cámara Colombiana de Comercio Electrónico. (2023). Informe de transformación digital en MiPyME.

- Computrabajo. (2025). Salarios para desarrollador de software en Colombia. https://www.computrabajo.com.co/salarios/salario-de-desarrollador-de-software-en-colombia

- Consejo General de Colegios de Ingeniería en Informática (CCII). (s.f.). Competencias de la ingeniería informática. https://www.ccii.es/ejercicio-profesional-informatica/competencias-ingenieria-informatica

- Congreso de la República de Colombia. (1982, enero 28). Ley 23 de 1982: Sobre derechos de autor. http://www.secretariasenado.gov.co/senado/basedoc/ley_0023_1982.html

- Congreso de la República de Colombia. (1999, agosto 18). Ley 527 de 1999. http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html

- Congreso de la República de Colombia. (2008, diciembre 31). Ley 1266 de 2008. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488

- Congreso de la República de Colombia. (2009, julio 30). Ley 1341 de 2009. http://www.secretariasenado.gov.co/senado/basedoc/ley_1341_2009.html

- Congreso de la República de Colombia. (2011, octubre 12). Ley 1480 de 2011. http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html

- Congreso de la República de Colombia. (2012, octubre 17). Ley 1581 de 2012. http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html

- Departamento Administrativo Nacional de Estadística (DANE). (2024). Encuesta de micronegocios (EMICRON) 2023: Boletín técnico. https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/micronegocios

- Departamento Administrativo Nacional de Estadística (DANE). (s.f.). Encuesta de micronegocios (EMIC).

- Django Software Foundation. (s.f.). Django documentation. https://docs.djangoproject.com/

- Durán Mero, R. A. (2025). Transformación digital en las pymes ecuatorianas: desafíos y oportunidades. Revista Eucken. https://revistaeucken.com/indes/index.php/home/article/view/transformacion-digital-pymes

- Fundación WWB Colombia. (2024, junio 27). Los retos de las "micro", las pequeñas y medianas empresas del país. https://www.fundacionwwbcolombia.org/fundacion-en-medios-post/los-retos-de-las-micro-las-pequenas-y-medianas-empresas-del-pais/

- Gobierno de Colombia. (s.f.). Estrategia nacional digital de Colombia. https://www.mintic.gov.co/portal/715/articles-334120_recurso_1.pdf

- Gómez, C. (2025). Microempresas: Más de la mitad carece de registros financieros formales. Portafolio. https://www.portafolio.co/negocios/empresas/microempresas-mas-de-la-mitad-carece-de-registros-financieros-formales-643178

- Microsoft. (2025, octubre 2). Introducción a las aplicaciones web progresivas (PWA). https://learn.microsoft.com/es-es/microsoft-edge/progressive-web-apps/

- Ministerio de Tecnologías de la Información y las Comunicaciones. (2022, marzo 25). Importante fortalecimiento de la economía digital. https://www.mintic.gov.co/portal/inicio/Sala-de-prensa/Noticias/208488

- Ministerio de Tecnologías de la Información y las Comunicaciones. (2023). Índice de brecha digital 2023 - Colombia TIC. https://colombiatic.mintic.gov.co/679/articles-396961_recurso_1.pdf

- Mozilla. (s.f.). IndexedDB API. https://developer.mozilla.org/

- Muñoz Ruano, J. H., Segura, J. M., & Mendoza, J. H. (s.f.). Un sistema ERP para las PYMES en América Latina: revisión de literatura. Fundación Universitaria de Popayán. https://fupvirtual.edu.co/repositorio/files/original/b54dcaf378e7ee4135b7b0e7dce6ca6078812d01.pdf

- Odoo. (2026). Gestiona todo tu negocio desde un solo software. https://www.odoo.com/es

- Otero Cortés, A., et al. (2025). Nueva evidencia sobre la informalidad laboral y empresarial en Colombia. Banco de la República. https://repositorio.banrep.gov.co/server/api/core/bitstreams/6db78584-da96-4f8b-a0c9-fb5a306cdffc/content

- Pichén Moreno, J. A. (2025). Transformación digital en las mypes: Una revisión sistemática de literatura 2021 al 2025. Multidisciplinary Latin American Journal (MLAJ), 3(3), 1-17. https://doi.org/10.62131/MLAJV3-N3-001

- Pinillos Aldoradin, L. F., Salinas Aliaga, A. D., & Vásquez Espinoza, J. M. (2024). Gestión de inventario y optimización de stock en la industria en general: Una revisión sistemática. Proceedings LACCEI LEIRD 2024. https://dx.doi.org/10.18687/LEIRD2024.1.1.471

- Pressman, R. S., & Maxim, B. R. (2020). Software engineering: A practitioner's approach (9th ed.). McGraw-Hill.

- Presidencia de la República de Colombia. (2015, mayo 26). Decreto 1078 de 2015. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=77324

- Python Software Foundation. (s.f.). About Python. https://www.python.org/

- Marcotte, E. (2010). Responsive web design. A List Apart. https://alistapart.com/article/responsive-web-design/

- Sarmiento Suárez, J., Gutiérrez Navas, E., & Ramírez Montañez, J. (2024). Oportunidades y desafíos para la digitalización de las mipymes en Colombia. Pensamiento & Gestión, (57), 128-154. https://dx.doi.org/10.14482/pege.57.240.855

- Schwaber, K., & Sutherland, J. (2020). The Scrum Guide. https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf

- Scrum Guides. (2020). La guía de Scrum. https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf

- Square. (2026). A POS ready for what you've got. https://squareup.com/us/en/point-of-sale

- Whaticket. (2025). Treinta app: Qué es y cómo funciona. https://whaticket.com/blog/treinta-app-como-funciona/

# **7. Anexos**

## **Anexo A. Conceptos adicionales del marco teórico**

En este anexo se presentan conceptos tecnológicos complementarios que sustentan el desarrollo de la solución propuesta. Se incluyen definiciones relacionadas con el uso de aplicaciones web progresivas, mecanismos de almacenamiento local y diseño adaptativo, los cuales permiten comprender las decisiones técnicas adoptadas en el sistema y su pertinencia en entornos de micro-comercios con recursos tecnológicos limitados.

- **PWA (Progressive Web App): **Google Developers (2023) define las PWA como experiencias que combinan los beneficios de la web tradicional con las capacidades de aplicaciones nativas. Esta tecnología proporciona la portabilidad y rapidez necesaria para que el sistema sea accesible en el entorno del micro-comercio.

- **IndexedDB (Persistencia Local): **Según Mozilla Developer Network (s.f.), esta API permite el almacenamiento de datos en el cliente de alto rendimiento. Es la pieza tecnológica que garantiza la "actualización continua" y la operación del sistema en escenarios sin conexión a internet.

- **Responsive Design (Diseño Adaptativo): **Concepto introducido por Marcotte (2011) que permite que la interfaz se adapte al entorno del usuario. Es vital para asegurar que la aplicación sea plenamente funcional tanto en dispositivos móviles de gama baja como en ordenadores de escritorio.

## **Anexo B. Tabla comparativa de aplicaciones de gestión para micro-comercios**

En este anexo se incluye una tabla comparativa en la que se analizan diferentes aplicaciones de gestión utilizadas como antecedentes del proyecto. En ella se contrastan aspectos como la gestión de ventas, inventario, órdenes de trabajo, manejo de cuentas abiertas, enfoque en micro-negocios y facilidad de uso. Esta comparación permite identificar de manera clara las fortalezas y limitaciones de cada solución frente a la propuesta desarrollada.

*Tabla. Comparación de aplicaciones de gestión para micro-comercios*

| **Aplicación** | **Ventas** | **Órdenes de trabajo** | **Inventario** | **Mesas dinámicas / cuentas abiertas** | **Enfoque en micro-negocios** | **Facilidad de uso** |
| --- | --- | --- | --- | --- | --- | --- |
| Odoo | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Square POS | ✔ | ✖ | ✔ | ✖ | ✔ | ✔ |
| Alegra | ✔ | ✖ | ✔ | ✖ | ✖ | ✔ |
| Treinta | ✔ | ✖ | ✔ | ✔ | ✔ | ✔ |
| Propuesta (SADIM) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

*Nota. Elaboración propia*

## **Anexo C. Normativa legal del proyecto**

En este anexo se presentan las principales normativas legales que enmarcan el desarrollo y uso de la solución propuesta. Estas disposiciones regulan aspectos relacionados con la protección de datos personales, el uso de tecnologías de la información, la propiedad intelectual y la relación con el consumidor, proporcionando un sustento legal que orienta el manejo de la información, la seguridad del sistema y la correcta prestación de los servicios dentro del contexto de micro-comercios.

### **Protección de Datos Personales y Habeas Data**

- **Ley 1581 de 2012: **Conocida como la Ley General de Protección de Datos Personales, dicta las disposiciones para el tratamiento de información de ciudadanos (Congreso de la República, 2012). En el proyecto, su aplicación es esencial para la captura y almacenamiento de datos de contacto del cliente en el Módulo de Flujo de Entrega, asegurando el derecho a la privacidad.

- **Ley 1266 de 2008: **Regula el manejo de la información contenida en bases de datos, especialmente la financiera y crediticia (Congreso de la República, 2008). Esta normativa respalda técnicamente el sistema de "cuentas abiertas" y el registro de medios de pago (efectivo, QR), donde se gestionan obligaciones pendientes y flujos de caja que requieren integridad y seguridad en el manejo del dato económico.

### **Tecnologías de la Información y Propiedad Intelectual**

- **Ley 1341 de 2009: **Define los principios sobre la Sociedad de la Información y la organización de las TIC (Congreso de la República, 2009). Representa el marco legal para el desarrollo de soluciones como la PWA propuesta, cuyo fin es la modernización de los sistemas manuales de registro en sectores vulnerables.

- **Decreto 1078 de 2015: **Establece el Reglamento Único del Sector TIC (MinTIC, 2015). Provee los lineamientos técnicos para los servicios digitales y el software en Colombia, asegurando que el desarrollo cumpla con estándares de calidad gubernamentales.

- **Ley 23 de 1982: **Sobre Derechos de Autor, protege la propiedad intelectual de las creaciones literarias, científicas y artísticas, incluyendo el código fuente del software (Congreso de la República, 1982). Esta ley ampara la autoría del desarrollo modular frente a copias o usos no autorizados.

### **Comercio y Relación con el Consumidor**

- **Ley 1480 de 2011 (Estatuto del Consumidor): **Regula la protección al consumidor frente a la información y calidad de los productos (Congreso de la República, 2011). Su aplicación en el software es crítica para la transparencia en la visualización de precios, el registro fidedigno de las condiciones del producto recibido en el taller o lavandería, y el cumplimiento de los tiempos de entrega prometidos en el módulo de servicios.

## **Anexo D. Figura complementaria del proceso Scrum**

En este anexo se presenta la Figura D1 que ilustra el flujo de trabajo de la metodología Scrum. La imagen permite visualizar la relación entre los eventos principales, como la planificación del sprint, el desarrollo, las reuniones diarias, la revisión y la retrospectiva, facilitando la comprensión del enfoque iterativo aplicado en el proyecto. El diagrama refleja el ciclo completo de Scrum: al finalizar cada sprint se entrega un incremento funcional susceptible de revisión y prueba; los hallazgos e identificados por el Product Owner se incorporan al Product Backlog y se priorizan para el siguiente ciclo, garantizando así la inspección y mejora continua del producto en cada iteración.

*Figura D1. Flujo de trabajo de la metodología Scrum*

*[Insertar aquí el archivo diagrama_scrum_sadim.svg]*

*Nota. Elaboración propia. El diagrama refleja el ciclo iterativo de Scrum según Schwaber y Sutherland (2020).*

## **Anexo E. Tareas y entregables por Sprint**

En este anexo se presenta una tabla que organiza las tareas y entregables definidos para cada sprint del proyecto. En ella se detallan las actividades específicas a desarrollar en cada fase, así como los resultados esperados, lo que permite evidenciar la planificación estructurada del trabajo y la evolución progresiva del sistema a lo largo del desarrollo.

*Tabla E1. Tareas y entregables por Sprint*

| **Sprint** | **Tareas** | **Entregables** |
| --- | --- | --- |
| Sprint 1 – Análisis y definición de requerimientos | • Definir el problema y alcance del sistema. • Identificar requerimientos funcionales y no funcionales. • Definir tipos de negocio y módulos del sistema. • Establecer el concepto de sesiones dinámicas. • Elaborar el modelo conceptual. | • Documento de requerimientos. • Definición de módulos y sesiones dinámicas. • Modelo conceptual del sistema. |
| Sprint 2 – Diseño del sistema y arquitectura | • Diseñar la arquitectura de la aplicación (PWA). • Diseñar la base de datos. • Definir flujos operativos del sistema. • Diseñar la interfaz de usuario. • Definir lógica de órdenes y mesas dinámicas. | • Documento de diseño del sistema. • Modelo de base de datos. • Prototipo de interfaz (mockups). |
| Sprint 3 – Desarrollo e implementación de funcionalidades | • Implementar autenticación de usuarios. • Desarrollar módulos (ventas, órdenes, inventario y financiero). • Implementar mesas dinámicas. • Integrar los módulos del sistema. • Realizar pruebas unitarias e integración. | • Módulos funcionales implementados. • Sistema integrado (versión inicial). |
| Sprint 4 – Pruebas, validación y cierre del proyecto | • Realizar pruebas funcionales del sistema. • Validar en entorno real. • Corregir errores y optimizar el sistema. • Elaborar documentación final. • Preparar la entrega del proyecto. | • Versión final del sistema. • Informe de pruebas y validación. • Documentación final del proyecto. |

*Nota. Elaboración propia*

## **Anexo F. Cronograma de actividades**

En este anexo se incluye el cronograma del proyecto, donde se distribuyen las actividades por semanas dentro de cada sprint. Esta representación permite visualizar la secuencia temporal del desarrollo, la duración de cada actividad y la organización del trabajo en función del tiempo establecido para la ejecución del proyecto.

*Figura F1. Cronograma actividades*

*[Insertar aquí el cronograma con el diagrama de Gantt original]*

## **Anexo G. Costos del proyecto**

En este anexo se presentan las tablas detalladas de los costos asociados a los recursos humanos, tecnológicos y administrativos. Cada tabla desglosa los elementos utilizados, su cantidad, el tiempo estimado y los valores correspondientes, permitiendo comprender de manera más precisa la inversión requerida para el desarrollo del proyecto y complementando el resumen de costos presentado en el documento principal.

*[Insertar aquí las Figuras G1, G2 y G3 de recursos humanos, tecnológicos y administrativos del documento original]*

*Figura G4. Costo total del proyecto*

| **Item** | **Total** |
| --- | --- |
| Recursos humanos | $ 19.680.000 |
| Recursos tecnológicos | $ 7.000.000 |
| Recurso Administrativo | $ 800.000 |
| Costo sin previsión de contingencias | $ 27.480.000 |
| Previsión de contingencias (=10%) | $ 2.748.000 |
| **Costo total del proyecto** | **$ 30.228.000** |

*Nota. Elaboración propia*