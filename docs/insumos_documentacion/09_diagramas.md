Actualizado al commit 7326a5a (03/10/2026)

# 09 — Diagramas (generados desde el código real)

> Sintaxis Mermaid revisada a mano (no hay `mermaid-cli` instalado y no se agregaron dependencias): se evitaron punto y coma, llaves y la palabra reservada `end` dentro de etiquetas. Cada diagrama indica los archivos de origen.

---

## 1. ERD (modelos Django)

Fuente: `backend/*/models.py`. Se muestran PK, FK, UK y los campos principales; se omiten los campos técnicos de Django en `Usuario` (`is_staff`, `is_superuser`, `last_login`, grupos y permisos).

```mermaid
erDiagram
    Usuario {
        uuid id PK
        string nombre_completo
        string username UK
        string password_hash
        string rol "ADMIN u OPERADOR"
        bool activo
        datetime fecha_creacion
    }
    Dispositivo {
        uuid id PK
        uuid identificador UK
        string nombre UK
        bool es_caja
        bool autorizado_offline "solo uno en true"
        bool activo
        uuid registrado_por_id FK
        datetime fecha_registro
        datetime ultima_sincronizacion
    }
    ConfiguracionModulo {
        uuid id PK "fila unica"
        bool ventas_activo
        bool inventario_activo
        bool servicios_activo
        bool finanzas_activo
        uuid actualizado_por_id FK "nullable"
        datetime actualizado_en
    }
    ConfiguracionPago {
        uuid id PK "fila unica"
        bool acepta_efectivo
        bool acepta_transferencia
        bool acepta_qr
        string nequi_titular
        string nequi_llave
        uuid actualizado_por_id FK
        datetime actualizado_en
    }
    OperacionSincronizacion {
        uuid id PK
        uuid operation_id UK
        uuid dispositivo_id FK "nullable"
        uuid usuario_id FK
        string recurso
        string accion
        string estado
        string origen
        string codigo_conflicto
        string mensaje
        uuid objeto_id
        json payload
        int status_code_original
        datetime fecha_cliente
        datetime fecha_procesamiento
        bool atendida
    }
    Categoria {
        uuid id PK
        uuid operation_id UK
        string nombre UK
    }
    Producto {
        uuid id PK
        uuid operation_id UK
        uuid categoria_id FK
        string nombre
        string tipo
        decimal precio_venta
        decimal costo_produccion
        decimal stock_actual
        decimal stock_minimo
        bool controla_stock
        string unidad_medida
        bool activo
    }
    MovimientoInventario {
        uuid id PK
        uuid operation_id UK
        uuid producto_id FK
        uuid usuario_id FK
        uuid venta_id FK "nullable"
        uuid consumo_orden_id FK "nullable unico"
        string tipo
        decimal cantidad
        string sentido
        datetime fecha
        string motivo
    }
    Mesa {
        uuid id PK
        uuid operation_id UK
        int numero UK "1 a 15"
        bool activa
        string estado
    }
    Venta {
        uuid id PK
        uuid operation_id UK
        string tipo
        uuid usuario_id FK
        uuid mesa_id FK "nullable"
        string estado
        datetime fecha_apertura
        datetime fecha_cierre
        string medio_pago
        string estado_pago
        decimal total
    }
    DetalleVenta {
        uuid id PK
        uuid operation_id UK
        uuid venta_id FK
        uuid producto_id FK
        decimal cantidad
        decimal precio_unitario
        decimal subtotal
    }
    OrdenTrabajo {
        uuid id PK
        uuid operation_id UK
        uuid usuario_id FK
        string cliente_nombre
        string cliente_telefono
        text descripcion
        datetime fecha_solicitud
        date fecha_entrega_estimada
        string estado
        decimal costo_total
        decimal saldo_pendiente
        decimal utilidad_neta
    }
    Abono {
        uuid id PK
        uuid operation_id UK
        uuid orden_id FK
        uuid usuario_id FK
        decimal valor
        string medio_pago
        string estado_pago
        datetime fecha
        string observacion
    }
    ConsumoOrden {
        uuid id PK
        uuid operation_id UK
        uuid orden_id FK
        uuid producto_id FK
        decimal cantidad
        string estado
        datetime fecha_registro
    }
    CostoOperativoOrden {
        uuid id PK
        uuid operation_id UK
        uuid orden_id FK
        string concepto
        decimal valor
    }
    MovimientoCaja {
        uuid id PK
        uuid operation_id UK
        uuid usuario_id FK
        uuid venta_id FK "nullable unico"
        uuid abono_id FK "nullable unico"
        uuid cierre_caja_id FK "nullable"
        string tipo
        string medio_pago
        string estado_pago
        decimal valor
        string concepto
        datetime fecha
        datetime fecha_confirmacion
        string motivo_anulacion
    }
    CierreCaja {
        uuid id PK
        uuid operation_id UK
        uuid usuario_id FK
        date fecha UK
        datetime periodo_inicio
        datetime periodo_fin
        decimal total_ingresos_ventas
        decimal total_ingresos_abonos
        decimal total_gastos
        decimal total_neto
        decimal efectivo_esperado
        decimal efectivo_contado
        decimal diferencia
        text observaciones
        datetime fecha_creacion
    }

    Usuario ||--o{ Dispositivo : "registra"
    Usuario |o--o{ ConfiguracionModulo : "actualiza"
    Usuario ||--o{ ConfiguracionPago : "actualiza"
    Usuario ||--o{ OperacionSincronizacion : "origina"
    Dispositivo |o--o{ OperacionSincronizacion : "envia"
    Categoria ||--o{ Producto : "agrupa"
    Producto ||--o{ MovimientoInventario : "afecta"
    Usuario ||--o{ MovimientoInventario : "registra"
    Venta |o--o{ MovimientoInventario : "SALIDA_VENTA"
    ConsumoOrden |o--o| MovimientoInventario : "SALIDA_SERVICIO"
    Mesa |o--o{ Venta : "aloja sesiones"
    Usuario ||--o{ Venta : "atiende"
    Venta ||--o{ DetalleVenta : "contiene"
    Producto ||--o{ DetalleVenta : "vendido en"
    Usuario ||--o{ OrdenTrabajo : "registra"
    OrdenTrabajo ||--o{ Abono : "recibe"
    Usuario ||--o{ Abono : "registra"
    OrdenTrabajo ||--o{ ConsumoOrden : "usa"
    Producto ||--o{ ConsumoOrden : "consumido en"
    OrdenTrabajo ||--o{ CostoOperativoOrden : "tiene"
    Usuario ||--o{ MovimientoCaja : "registra"
    Venta |o--o| MovimientoCaja : "INGRESO_VENTA"
    Abono |o--o| MovimientoCaja : "INGRESO_ABONO"
    CierreCaja |o--o{ MovimientoCaja : "consolida"
    Usuario ||--o{ CierreCaja : "realiza"
```

---

## 2. Despliegue

Fuente: `Dockerfile`, `render.yaml`, `backend/core/settings.py`, `frontend/vite.config.ts`.

```mermaid
flowchart LR
    subgraph Cliente["Dispositivo del negocio"]
        NAV["Navegador o PWA instalada"]
        SW["Service Worker Workbox - shell precacheado"]
        IDB[("IndexedDB sadim - Dexie v2: meta, catalogo, operaciones_locales, cola_sincronizacion, novedades")]
        NAV --- SW
        NAV --- IDB
    end

    subgraph Render["Render - Web Service sadim, Docker, plan Free, Virginia"]
        WN["WhiteNoise: frontend/dist y /static/"]
        GU["gunicorn core.wsgi"]
        DJ["Django 6.1 + DRF 3.18 + SimpleJWT"]
        HC["GET /api/health/"]
        GU --> WN
        GU --> DJ
        DJ --- HC
    end

    subgraph Neon["Neon - PostgreSQL, us-east-1"]
        PG[("Base de datos")]
    end

    NAV -- "HTTPS mismo dominio: /, /assets, /sw.js" --> WN
    NAV -- "HTTPS /api/* con Bearer JWT y X-Device-Id" --> DJ
    DJ -- "DATABASE_URL con SSL, conn_max_age 600" --> PG
    GH["GitHub DanielsGil/sadim"] -- "git push dispara build Docker" --> Render
```

Sin cambios de estructura desde el 02/10. Desde B1 (`e57e7a6`), el servicio no arranca si falta `SECRET_KEY` con `DEBUG=False`; desde B2 (`fc6c598`), el service worker deja pasar `/api/` y `/admin/` al servidor.

---

## 3. Módulos del backend y relación con el frontend

Fuente: `backend/core/urls.py`, `*/urls.py`, `frontend/src/api/*`, `frontend/src/sync/*`.

```mermaid
flowchart TB
    subgraph FE["Frontend React + TS"]
        PAG["paginas/*"]
        APIC["api/* - un cliente por recurso"]
        ENR["sync/enrutador.ts - escribir en linea o encolar"]
        MOT["sync/motor.ts - envio por lotes"]
        DEX["db/baseLocal.ts - Dexie"]
        PAG --> APIC
        APIC --> ENR
        ENR --> DEX
        MOT --> DEX
    end

    subgraph BE["Backend Django - monolito modular"]
        CORE["core: errores, permisos, idempotencia, sync, configuracion, dispositivos, health, SPA"]
        USU["usuarios: auth y usuarios"]
        INV["inventario: categorias, productos, movimientos, stock"]
        VEN["ventas: mesas, ventas, detalles"]
        SER["servicios: ordenes, abonos, consumos, costos"]
        FIN["finanzas: movimientos de caja, resumen, cierres"]
        VEN --> INV
        VEN --> FIN
        SER --> INV
        SER --> FIN
        FIN --> VEN
        FIN --> SER
        CORE --> USU
        CORE --> INV
        CORE --> VEN
        CORE --> SER
        CORE --> FIN
    end

    APIC -- "/api/auth, /api/usuarios" --> USU
    APIC -- "/api/categorias, /api/productos, /api/inventario" --> INV
    APIC -- "/api/mesas, /api/ventas" --> VEN
    APIC -- "/api/ordenes-trabajo" --> SER
    APIC -- "/api/movimientos-caja, /api/cierres-caja" --> FIN
    APIC -- "/api/configuracion, /api/dispositivos, /api/sync/novedades" --> CORE
    MOT -- "POST /api/sync/" --> CORE
```

Banderas: `ventas_activo` (VEN), `inventario_activo` (movimientos y stock de INV), `servicios_activo` (SER), `finanzas_activo` (FIN). Catálogo, usuarios, configuración, dispositivos y sync no dependen de bandera.

---

## 4. Secuencia de sincronización offline

Fuente: `frontend/src/sync/enrutador.ts`, `motor.ts`, `almacenDexie.ts`, `reconciliacion.ts`, `frontend/src/api/ventas.ts`, `backend/core/sync.py`, `core/idempotencia.py`.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant P as Pantalla
    participant E as enrutador.escribir
    participant D as IndexedDB Dexie
    participant M as motor.sincronizar
    participant S as POST /api/sync/
    participant SV as services.py
    participant DB as PostgreSQL

    U->>P: Registra operacion sin conexion
    P->>E: escribir(resource, action, payload con precio_unitario mostrado si es venta - D19)
    E->>E: navigator.onLine es false o la cola no esta vacia
    E->>D: guarda en cola_sincronizacion con operation_id y fecha_cliente
    E->>D: guarda en operaciones_locales y propietario_cola
    E-->>P: resultado provisional calculado en el dispositivo
    P-->>U: muestra valores con etiqueta provisional

    Note over U,D: Se recupera la conexion - evento online, intervalo de 15 s o apertura de la app

    M->>D: lista la cola ordenada por creado_en
    M->>S: lote de hasta 200 operaciones con Bearer y X-Device-Id
    S->>DB: valida dispositivo activo y autorizado
    alt Dispositivo no autorizado
        S-->>M: 403 DISPOSITIVO_NO_AUTORIZADO
        M->>D: conserva la cola intacta
    else Dispositivo autorizado
        loop Cada operacion en orden
            S->>DB: busca operation_id en OperacionSincronizacion
            alt Ya procesada
                S-->>S: resultado DUPLICADA con estado_original
            else Nueva
                S->>SV: misma funcion de servicio que en linea con fecha_cliente
                SV->>DB: transaccion atomica con efectos en stock y caja
                SV-->>S: exito o ErrorNegocio
                S->>DB: registra APLICADA, RECHAZADA o CONFLICTO
            end
        end
        S-->>M: 200 con results por operacion
        M->>D: quita APLICADA y DUPLICADA de la cola
        M->>D: quita RECHAZADA y CONFLICTO y las guarda en novedades con su estado real
        M->>S: reconciliar - GET catalogo, mesas, ventas abiertas, ordenes, configuracion
        S-->>M: estado actual del servidor
        M->>D: reemplaza copias locales
    end
    U->>P: abre Novedades
    P->>S: GET /api/sync/novedades/?atendida=false
    S-->>P: operaciones RECHAZADA o CONFLICTO
    U->>P: corrige con una operacion nueva y pulsa Marcar atendida
    P->>S: PATCH /api/sync/novedades/id con atendida true
```

---

## 5. Secuencia de venta rápida (en línea)

Fuente: `frontend/src/componentes/FormularioVentaRapida.tsx`, `BandejaSeleccion.tsx`, `frontend/src/api/ventas.ts`, `backend/ventas/views.py:94-125`, `ventas/services.py:150-217`, `inventario/services.py:162-181`.

```mermaid
sequenceDiagram
    actor O as Operador
    participant F as FormularioVentaRapida
    participant V as VentaViewSet.create
    participant I as idempotencia
    participant S as crear_venta_rapida
    participant DB as PostgreSQL

    O->>F: toca productos - cada toque suma 1 en la bandeja local
    O->>F: elige medio de pago y pulsa Cobrar
    F->>V: POST /api/ventas/ tipo RAPIDA con operation_id, medio_pago y detalles - sin precio en linea
    V->>I: ejecutar_con_idempotencia
    I->>DB: busca operation_id
    I->>S: ejecutar dentro de transaction.atomic
    S->>DB: valida medio de pago habilitado en ConfiguracionPago
    S->>DB: select_for_update de los productos en orden estable
    S->>S: valida productos activos y existencias de todos - D12
    alt Falta stock o producto inactivo
        S-->>I: 409 STOCK_INSUFICIENTE o PRODUCTO_INACTIVO
        I->>DB: revierte efectos y registra RECHAZADA o CONFLICTO
        I-->>F: error con details.productos
    else Todo valido
        S->>DB: crea Venta RAPIDA en estado CERRADA
        S->>DB: crea DetalleVenta con precio vigente y subtotal
        S->>DB: por cada producto con controla_stock crea MovimientoInventario SALIDA_VENTA y resta stock_actual
        S->>DB: actualiza total de la venta
        S->>DB: crea un MovimientoCaja INGRESO_VENTA - efectivo CONFIRMADO, electronico PENDIENTE_VERIFICACION
        I->>DB: registra OperacionSincronizacion APLICADA origen EN_LINEA
        I-->>F: 201 con la venta
        F->>F: vacia la bandeja guardada y recarga el mapa
    end
```

---

## 6. Secuencia de cuenta de mesa (sesión dinámica) hasta el cobro

Fuente: `frontend/src/paginas/DetalleSesion.tsx:191-291` (D26, E-12), `backend/ventas/services.py:220-399`.

```mermaid
sequenceDiagram
    actor O as Operador
    participant P as DetalleSesion y bandeja
    participant API as /api/ventas
    participant S as ventas.services
    participant DB as PostgreSQL

    O->>P: toca una mesa libre - no se envia nada
    O->>P: toca productos - se suman en la bandeja guardada en el dispositivo
    O->>P: pulsa Agregar a la mesa
    P->>API: POST /api/ventas/ tipo SESION_DINAMICA con mesa_id
    API->>S: abrir_sesion_dinamica
    S->>DB: crea Venta ABIERTA - indice unico parcial por mesa
    S->>DB: Mesa pasa a OCUPADA
    loop Un POST por cada producto de la bandeja, en orden
        P->>API: POST /api/ventas/id/detalles/
        API->>S: agregar_detalle con validar_stock en linea - D24
        S->>DB: valida cantidad acumulada contra stock_actual sin descontar
        S->>DB: crea DetalleVenta y recalcula total
    end
    alt Falla el primer producto de una cuenta recien abierta
        P->>API: PATCH /api/ventas/id/cancelar/
        P-->>O: la bandeja queda completa con el error en la primera linea
    else Falla un producto posterior
        P-->>O: la bandeja conserva solo las lineas fallidas con su error
    end
    Note over O,DB: Se repite agregar o quitar mientras la venta este ABIERTA

    O->>P: elige medio de pago y pulsa Cobrar y cerrar cuenta
    P->>API: PATCH /api/ventas/id/cerrar/
    API->>S: cerrar_venta
    S->>DB: select_for_update de la venta
    S->>DB: valida existencias de todas las lineas - D12
    alt Falta stock
        S-->>P: 409 STOCK_INSUFICIENTE - la venta sigue ABIERTA y la mesa OCUPADA
    else Hay stock
        S->>DB: MovimientoInventario SALIDA_VENTA por linea con controla_stock y resta stock
        S->>DB: Venta CERRADA con fecha_cierre, medio_pago y estado_pago
        S->>DB: un MovimientoCaja INGRESO_VENTA por el total
        S->>DB: Mesa pasa a DISPONIBLE
        S-->>P: 200 con la venta cerrada
        P->>P: vacia la bandeja de la mesa y vuelve al mapa
    end
```

---

## 7. Diagramas de estado

Fuente: `ventas/models.py`, `ventas/services.py`, `servicios/services.py:17-22`, `:116-180`, `finanzas/services.py:69-135`.

### 7.1 Venta

```mermaid
stateDiagram-v2
    [*] --> CERRADA: venta RAPIDA nace cerrada
    [*] --> ABIERTA: abrir SESION_DINAMICA
    ABIERTA --> ABIERTA: agregar o quitar detalle
    ABIERTA --> CERRADA: cerrar con medio de pago y stock suficiente
    ABIERTA --> CANCELADA: cancelar sin efectos
    CERRADA --> [*]
    CANCELADA --> [*]
    note right of CERRADA
        Cualquier cambio posterior
        responde 409 VENTA_YA_CERRADA
    end note
```

### 7.2 Mesa

```mermaid
stateDiagram-v2
    state "Mesa activa" as Activa {
        [*] --> DISPONIBLE
        DISPONIBLE --> OCUPADA: se abre una sesion
        OCUPADA --> DISPONIBLE: se cierra o cancela la sesion
    }
    [*] --> Activa: crear mesa, maximo 15 activas
    Activa --> Inactiva: desactivar, solo si esta DISPONIBLE
    Inactiva --> Activa: reactivar, revalida el limite de 15
```

### 7.3 OrdenTrabajo

```mermaid
stateDiagram-v2
    [*] --> RECIBIDO: crear orden, saldo igual a costo_total
    RECIBIDO --> EN_PROCESO
    EN_PROCESO --> LISTO
    LISTO --> ENTREGADO: atomico, aplica consumos y descuenta stock
    LISTO --> LISTO: entrega rechazada por STOCK_INSUFICIENTE
    ENTREGADO --> [*]
    note right of ENTREGADO
        Estado final - cambios, consumos y costos
        responden 409 ORDEN_YA_ENTREGADA.
        Saltar o retroceder responde 400.
    end note
```

### 7.4 ConsumoOrden

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE: registrar consumo en RECIBIDO, EN_PROCESO o LISTO
    PENDIENTE --> APLICADO: la orden pasa a ENTREGADO
    APLICADO --> [*]
```

### 7.5 estado_pago (MovimientoCaja, Venta, Abono)

```mermaid
stateDiagram-v2
    [*] --> CONFIRMADO: medio EFECTIVO
    [*] --> PENDIENTE_VERIFICACION: medio TRANSFERENCIA o QR
    PENDIENTE_VERIFICACION --> CONFIRMADO: confirmar en linea, ADMIN u OPERADOR
    PENDIENTE_VERIFICACION --> ANULADO: anular con motivo, solo ADMIN
    CONFIRMADO --> [*]: entra al siguiente cierre de caja
    ANULADO --> [*]: no entra a cierre ni a resumen
```

---

## 8. Casos de uso por módulo (actores ADMIN y OPERADOR, según los permisos reales)

Fuente: matriz RBAC de `02b §5.2`.

```mermaid
flowchart LR
    ADM(["ADMIN"])
    OPE(["OPERADOR"])

    subgraph VENTAS["Modulo Ventas"]
        CU01(["CU-01 Venta rapida"])
        CU02(["CU-02 Abrir sesion de mesa"])
        CU03(["CU-03 Consumo en sesion"])
        CU04(["CU-04 Cerrar o cancelar sesion"])
        CU19(["CU-19 Gestionar mesas"])
    end

    subgraph NUCLEO["Nucleo y configuracion"]
        CU05(["CU-05 Catalogo"])
        CU16(["CU-16 Modulos"])
        CU17(["CU-17 Iniciar sesion"])
        CU18(["CU-18 Usuarios"])
        CU21(["CU-21 Dispositivos"])
        CU22(["CU-22 Medios de pago"])
        CU23(["CU-23 Novedades de sincronizacion"])
    end

    subgraph SERVICIOS["Modulo Servicios"]
        CU06(["CU-06 Registrar pedido"])
        CU07(["CU-07 Estado de la orden"])
        CU08(["CU-08 Abono"])
        CU09(["CU-09 Consumo en orden"])
        CU10(["CU-10 Costos y utilidad"])
    end

    subgraph INVENTARIO["Modulo Inventario"]
        CU11(["CU-11 Consultar stock"])
        CU12(["CU-12 Ingreso de mercancia"])
        CU13(["CU-13 Merma y ajuste"])
    end

    subgraph FINANZAS["Modulo Finanzas"]
        CU14(["CU-14 Gasto"])
        CONF(["Confirmar pago pendiente"])
        ANU(["Anular pago pendiente D15"])
        CU15(["CU-15 Cierre de caja"])
        CU20(["CU-20 Resumen diario"])
    end

    OPE --- CU01
    OPE --- CU02
    OPE --- CU03
    OPE --- CU04
    OPE --- CU17
    OPE --- CU23
    OPE --- CU06
    OPE --- CU07
    OPE --- CU08
    OPE --- CU09
    OPE --- CU11
    OPE --- CU12
    OPE --- CU14
    OPE --- CONF

    ADM --- CU01
    ADM --- CU02
    ADM --- CU03
    ADM --- CU04
    ADM --- CU19
    ADM --- CU05
    ADM --- CU16
    ADM --- CU17
    ADM --- CU18
    ADM --- CU21
    ADM --- CU22
    ADM --- CU23
    ADM --- CU06
    ADM --- CU07
    ADM --- CU08
    ADM --- CU09
    ADM --- CU10
    ADM --- CU11
    ADM --- CU12
    ADM --- CU13
    ADM --- CU14
    ADM --- CONF
    ADM --- ANU
    ADM --- CU15
    ADM --- CU20
```

---

## 9. Cierre de sesión por inactividad (D27) — estados del temporizador

Fuente: `frontend/src/contexto/inactividad.ts:7-122`, `frontend/src/componentes/Layout.tsx:41-76`, `frontend/src/contexto/SesionContext.tsx:79-92`.

```mermaid
stateDiagram-v2
    [*] --> ACTIVA: se monta Layout con sesion iniciada
    ACTIVA --> ACTIVA: interaccion del usuario reinicia 30 min
    ACTIVA --> AVISO: minuto 29 sin interaccion
    AVISO --> ACTIVA: cualquier interaccion
    AVISO --> Comprobar: minuto 30
    state Comprobar <<choice>>
    Comprobar --> Cerrada: navigator.onLine y cola vacia
    Comprobar --> EXPIRADA_PENDIENTE: sin red o con cola
    EXPIRADA_PENDIENTE --> Comprobar: cada 15 s o evento online
    EXPIRADA_PENDIENTE --> ACTIVA: interaccion del usuario - E-15
    Cerrada --> [*]: borra sesion y bandejas, nunca la cola, y va a /login
    note right of Comprobar
        cerrarSesion vuelve a contar la cola - D21.
        navigator.onLine no garantiza que el
        servidor responda - hallazgo F-19
    end note
```

---

## 10. Secuencia del cierre de caja con vista previa (D28)

Fuente: `frontend/src/componentes/PanelCierreCaja.tsx:44-101`, `backend/finanzas/views.py:156-201`, `backend/finanzas/services.py:192-339`.

```mermaid
sequenceDiagram
    actor A as Administrador
    participant P as Caja pestana Cierre
    participant V as CierreCajaViewSet
    participant S as finanzas.services
    participant DB as PostgreSQL

    A->>P: abre Caja y la pestana Cierre
    P->>V: GET /api/cierres-caja/vista-previa/
    V->>S: calcular_vista_previa_cierre
    S->>DB: movimientos CONFIRMADO sin cierre con fecha hasta ahora - sin bloquear
    S->>S: calcular_totales_cierre
    S-->>P: periodo, totales, efectivo_esperado, por_medio_pago, cantidad_movimientos
    P->>V: GET /api/cierres-caja/
    V-->>P: cierres anteriores
    P->>P: cuenta la cola local - si hay pendientes, boton deshabilitado - E-05
    A->>P: escribe efectivo contado
    P->>P: Diferencia estimada igual a contado menos efectivo_esperado - solo se muestra
    A->>P: pulsa Registrar cierre con fecha y observaciones
    P->>V: POST /api/cierres-caja/
    V->>S: crear_cierre dentro de ejecutar_con_idempotencia
    S->>DB: select_for_update de los mismos movimientos - criterio D14
    S->>S: calcular_totales_cierre - el mismo calculo de la vista previa
    alt Diferencia distinta de cero sin observaciones
        S-->>P: 400 DATOS_INVALIDOS
    else Ya hay cierre para esa fecha
        S-->>P: 409 CIERRE_YA_REALIZADO
    else Valido
        S->>DB: crea CierreCaja y asigna cierre_caja a los movimientos
        S-->>P: 201 con el cierre y la diferencia final
        P->>P: muestra Cierre registrado y recarga vista previa y cierres anteriores
    end
```

---

## Cambios respecto a la versión del 02/10

- §1 ERD y §3 módulos: sin cambios (no hubo migraciones ni módulos nuevos).
- §2 Despliegue: nota sobre `SECRET_KEY` obligatoria (B1) y el SW que deja pasar `/api/` y `/admin/` (B2).
- §4 Sincronización: el payload de ventas lleva el `precio_unitario` mostrado (D19) y las novedades locales guardan su estado real (B5).
- §5 Venta rápida: la bandeja reemplaza al carrito (E-12) y se vacía al cobrar (E-19).
- §6 rehecho: «Agregar a la mesa» envía un POST por producto, cancela la cuenta si falla el primero y el botón de cobro es «Cobrar y cerrar cuenta».
- §9 nuevo: estados del temporizador de inactividad (D27).
- §10 nuevo: cierre de caja con vista previa y cálculo compartido (D28).
- §7 y §8: sin cambios.
