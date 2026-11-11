# Plan de implementación: contingencia offline segura sin degradar el funcionamiento online

**Proyecto:** NextByte Café.  
**Fecha:** 11 de noviembre de 2026.  
**Revisión de referencia:** `7608cd2a70b827893e53c8e8d905bca076523084`.  
**Tipo de documento:** especificación y guía para otra IA; no es una implementación.  
**Prioridad del dueño:** conservar la estabilidad y las optimizaciones que actualmente funcionan muy bien con Internet.

## 0. Instrucciones para la IA que reciba este archivo

Implementá este plan por etapas y comprobá cada etapa antes de continuar. Primero leé las instrucciones del repositorio y verificá las rutas contra el commit sobre el que estés trabajando. No asumas que una función llamada `sync` sincroniza ni que `dbLocal` apunta a SQLite: hoy esos nombres son engañosos.

No vuelvas al código viejo completo. No hagas una reescritura general, no cambies el modelo de negocio y no actualices dependencias por conveniencia. Conservá el dialecto libSQL, los índices, las consultas agrupadas, las transacciones y las protecciones de stock e idempotencia existentes. Si una condición de seguridad de este documento no puede cumplirse, informala como pendiente: no la reemplaces por un `catch` vacío ni por una contingencia que solo cambia un cartel.

Este documento distingue:

- **Hechos verificados:** comportamiento del repositorio de referencia.
- **Diseño propuesto:** lo que hay que construir; no atribuirle pruebas ya realizadas.
- **Condiciones de despliegue:** decisiones operativas necesarias para que no existan dos escritores independientes.

La implementación requiere cambios coordinados de backend, frontend y Electron. Arreglar solamente `navigator.onLine` o cambiar un booleano de la base no alcanza.

### Resultado esperado

1. Con Internet, las operaciones siguen usando Turso y conservan las protecciones actuales.
2. Un fallo de Turso, una cuota, un error SQL o un timeout aislado **no** activa SQLite como alternativa.
3. Ante un corte de Internet confirmado por el backend de la caja, y con una copia local válida, únicamente el cajero autorizado del equipo principal puede operar offline.
4. Las operaciones offline sobreviven al cierre de la aplicación y al reinicio del equipo.
5. Al volver la conectividad, se sincronizan las operaciones pendientes sin duplicar ventas, descuentos de stock ni movimientos de caja.
6. No se vuelve al estado online normal hasta terminar y verificar la recuperación.
7. Si hay incertidumbre o conflicto, se muestra y se bloquea la escritura riesgosa; nunca se inventa un éxito.

---

## 1. Diagnóstico confirmado y archivos que importan

| Archivo | Situación actual verificada | Trabajo necesario |
|---|---|---|
| `backend/src/config/db.js` | Elige una sola base al iniciar. En cloud, `dbLocalDirect` es `null`. La referencia activa no cambia con la red. | Mantener el modo actual por defecto; incorporar conexiones explícitas y contexto por operación para el modo de contingencia opt-in. |
| `backend/knexfile.js` | Dialecto custom para Turso, pool cloud máximo 4; SQLite con pool 1, foreign keys, WAL y busy timeout. Ruta SQLite relativa al backend salvo override. | Conservar esas propiedades y admitir una ruta persistente escribible en Electron. |
| `backend/src/config/libsqlKnexClient.js` | HTTP con timeout; reintento acotado de lecturas; no repite escrituras ni sentencias dentro de transacciones. | No reemplazarlo ni agregarle fallback. Usar sus transacciones correctamente. |
| `backend/src/config/databaseErrors.js` | Distingue errores de red/SQL/cuota y considera ciertos 429/5xx como indisponibilidad cloud. | Separar disponibilidad de Turso de evidencia de pérdida de Internet. |
| `backend/src/middlewares/checkConnection.js` | Expone el estado conocido; no comprueba Internet ni selecciona otra base. | Exponer el estado del coordinador, sin consultas remotas por request. |
| `backend/src/middlewares/checkRole.js` | En `cloud` y `local` deja pasar antes de aplicar la restricción offline. La rama antigua admite también administradores. | Aplicar la política real del cajero, una vez autenticado, y distinguir modo local independiente de contingencia. |
| `backend/src/jobs/syncJob.js` | `iniciarSyncJob` y `detenerSyncJob` están vacíos. `sincronizar` devuelve deshabilitado. | Implementar un único worker recuperable por backend principal, no uno por usuario. |
| `backend/src/services/syncService.js` | Conserva lectura de pendientes viejos; registrar/reconciliar cambios está deshabilitado. | Nuevo protocolo transaccional; conservar pendientes antiguos para revisión, sin interpretarlos automáticamente como operaciones nuevas. |
| `backend/src/controllers/syncController.js`, `backend/src/routes/sync.routes.js` | Estado y endpoint manual; sincronización deshabilitada. | Contrato de estado real, permisos y disparo idempotente de un worker único. |
| `backend/src/app.js`, `backend/src/index.js` | Health usa estado conocido. El servidor espera que la base principal inicialice antes de escuchar. | Separar servidor vivo de base lista, permitir arranque con copia local válida y gestionar cierre ordenado. |
| `backend/src/services/*Service.js`, `backend/src/repositories/*Repository.js` | Lógica y consultas del negocio; existen accesos directos a la conexión importada. | Propagar contexto/transacción en los caminos afectados sin cambiar la lógica de negocio. |
| `frontend/src/services/api.js` | No publica el evento de conectividad que escucha el layout. | Propagar estado estructurado del backend, sin inferir modo offline por cualquier error. |
| `frontend/src/layouts/DashboardLayout.jsx` | Depende de `navigator.onLine`, escucha un evento no emitido y reintenta con health. | Mostrar estado de backend y bloquear según permisos reales. |
| `frontend/src/context/AuthContext.jsx` | Conserva sesión ante fallos que no sean 401. | Mantenerlo; no convertir fallos de red/503 en cierre de sesión. |
| `frontend/src/services/pedidoService.js` | Conserva claves de envío para pedidos. No es una outbox de negocio. | Preservar esas claves y ampliar idempotencia para otras mutaciones permitidas offline. |
| `electron/main.js`, `package.json` | Electron levanta Express local; no prepara SQLite en `userData`. | Inicializar ruta persistente, instancia única y roles de instalación antes de importar el backend. |
| `backend/.env.example`, `README.md` | `APP_ROLE` aparece en el ejemplo, pero no controla actualmente el backend. README todavía describe sincronización automática. | Documentar solo el comportamiento implementado y las condiciones de despliegue. |

### Qué cambió en el historial

- `fe273db`: eliminó el cambio dinámico de base y pasó a una autoridad fija.
- `3a73d3d`: deshabilitó el job y la reconciliación anterior.
- El código viejo detectaba red de forma amplia y reconciliaba tablas completas. Había riesgo de repetir una escritura cuyo resultado remoto era incierto, sobrescribir datos y generar demasiadas consultas.

No hay evidencia suficiente para atribuir estos cambios a una IA específica. Sí hay evidencia de que la contingencia dejó de implementarse como circuito operativo.

### Evidencia de pruebas existente

Durante la investigación previa pasaron **108 pruebas de 5 suites**: `databaseMode`, `sync`, `offline`, `health` y `libsqlKnexClient`. Eso prueba el comportamiento actual, no la contingencia propuesta. Varias pruebas esperan expresamente que no exista fallback ni sincronización. Además, se reprodujo que un usuario no cajero atraviesa el control offline con `databaseMode=cloud` y `databaseMode=local`, aunque `isOnline=false`.

No se probó el instalador de Windows ni Turso real. No presentar esta evidencia como prueba de la futura implementación.

---

## 2. Lo que NO se debe romper

### 2.1 Camino online

- Mantener `@libsql/client` 0.18.0, Knex 3.3.0 y SQLite3 6.0.1 del lockfile de referencia, salvo incompatibilidad demostrada que se informe por separado.
- Mantener el cliente `LibsqlKnexClient`, su ciclo BEGIN/COMMIT/ROLLBACK y la disposición de conexiones dañadas.
- Mantener el límite del pool; no subirlo para disimular consultas excesivas.
- Mantener el timeout remoto acotado y la política de reintentar solo lecturas seguras fuera de transacciones.
- Mantener consultas agrupadas e índices de `20261108000001_add_performance_indexes.js`.
- No agregar un `SELECT 1` por request, por componente ni por navegador.
- No hacer una copia completa de cloud a local cada pocos segundos.
- No sincronizar desde interceptores Axios, desde cada repositorio ni desde cada pestaña.

La garantía de contingencia requiere persistencia adicional: intención local, registro transaccional remoto y espejo local. Por lo tanto **no prometer cero consultas ni cero latencia extra**. Medir el costo y mantenerlo acotado, proporcional a los cambios de cada operación, no al tamaño total de la base.

### 2.2 Integridad de negocio

Conservar sin reinterpretar:

- Idempotencia de creación de pedidos: misma clave y mismo payload no vuelven a descontar stock; misma clave con otro payload produce conflicto.
- Reserva de stock de **productos** al crear el pedido, dentro de una transacción y con actualización condicional.
- Transiciones de estado, compare-and-set y generación única de ventas en `comandaService`.
- Diferencias actuales entre completar, entregar, cancelar y eliminar ítems. **No mover el consumo de insumos o el registro de venta a otra etapa por introducir sincronización.** Leer las implementaciones y pruebas antes de modificarlas.
- Devoluciones/mermas de cancelación, precios y costos históricos de detalles, fechas operativas y redondeos.
- Claves foráneas, restricciones únicas, permisos y expiración de JWT.

No cambiar esquemas de IDs existentes para toda la aplicación. Usar UUID para IDs nuevos de operaciones y sesiones de contingencia; preservar IDs de filas y relaciones durante la réplica.

### 2.3 Prohibiciones expresas

No parchear prototipos de Knex, `.then`, `_single`, `_statements` ni otros campos privados para capturar consultas. No repetir una escritura en SQLite después de que haya fallado su envío a Turso. No copiar la base local completa sobre Turso. No usar `INSERT OR REPLACE` como resolución de conflictos. No desactivar foreign keys. No marcar pendiente como sincronizado solo porque existe alguna fila con el mismo ID.

---

## 3. Condición de arquitectura: un único escritor real

### 3.1 Topología de referencia para implementar este plan

La propuesta usa **un único backend coordinador en la PC principal de caja**:

- Esa PC tiene la conexión cloud y la base SQLite persistente de contingencia.
- Los navegadores y equipos secundarios usan ese backend por LAN.
- Online, el backend atiende a todos los usuarios autorizados contra Turso.
- Offline, el backend principal admite solamente las operaciones autorizadas del cajero y usa SQLite.
- Los secundarios no crean una SQLite propia ni levantan otro escritor independiente hacia Turso.
- Un cliente que pierde conexión con la PC principal muestra “servidor principal inaccesible”; no crea una contingencia nueva.

**No confundir usuario único con escritor único:** una misma cuenta puede abrirse en dos PCs. El rol por sí solo no protege contra dos bases locales divergentes.

### 3.2 Validar antes de implementar

1. Averiguar si hoy cada instalación de Electron levanta su propio backend escritor.
2. Identificar qué PC será la principal y cómo llegan a ella los secundarios.
3. Definir `APP_ROLE=CAJA_PRINCIPAL` y `APP_ROLE=SECUNDARIA` con validación real. La secundaria debe usar la URL del principal; no arrancar el backend escritor actual por defecto.
4. Dar al principal una identidad persistente `writer_id`, generada una sola vez y guardada fuera del código empaquetado.
5. No distribuir credenciales Turso de escritura en instaladores secundarios ni en el frontend.
6. Impedir por despliegue y credenciales que otros servidores o scripts de negocio escriban cloud por fuera de este coordinador.
7. Verificar alcance LAN, firewall y HTTPS para clientes de red. El envío actual de pedidos usa WebCrypto: una IP LAN por HTTP no es equivalente a `localhost` como contexto seguro.

Si se necesita que otra sede, otro backend o un equipo con datos móviles siga escribiendo independientemente mientras la caja está offline, **este diseño de escritor único no cubre ese escenario**. Hay que acordar otro protocolo de concurrencia antes de habilitarlo; no resolverlo ocultamente con “última escritura gana”.

### 3.3 Propiedad y fencing en cloud

Persistir en Turso el `writer_id` autorizado y una `generation` monotónica. Cada transacción de escritura del coordinador valida ambos. La sustitución de equipo exige un procedimiento explícito que aumente la generación y retire al dueño anterior.

No usar un lease que expire y habilite automáticamente una segunda caja: el equipo sin Internet no puede saber que perdió ese lease y podría seguir aceptando ventas localmente. No hacer failover automático en este alcance.

Un chequeo en una tabla no protege contra otra aplicación que conserve credenciales de escritura y omita el protocolo. Controlar también distribución/revocación de credenciales y el despliegue. Un cambio de dueño mientras la caja anterior sigue operativa offline está prohibido; requiere cerciorarse de que dejó de operar y recuperar sus pendientes.

---

## 4. Modelo de estado: no usar un único `isOnline`

El backend es autoridad. Separar al menos:

- `backendReachable`: lo observa cada cliente; conexión al servidor local/LAN.
- `internetStatus`: `reachable`, `unreachable` o `unknown`, observado desde el backend principal.
- `cloudStatus`: `reachable`, `unavailable`, `quota`, `auth_error` o `unknown`.
- `localReady`: copia íntegra, esquema compatible, journal aplicado y sin intenciones cloud inciertas.
- `mode`: estado operativo de la tabla siguiente.
- `pendingCount`, `uncertainCount`, `lastSuccessfulSyncAt`, `lastCloudSeq`, `writerId` y motivo estructurado.

| Estado | Lecturas operativas | Escrituras | Salida permitida |
|---|---|---|---|
| `STARTING` | Health/estado; todavía no prometer datos listos. | Bloqueadas. | Online, diagnóstico de dependencia o contingencia validada. |
| `ONLINE` | Turso, como hoy. | Turso con protocolo idempotente; espejo local se mantiene aparte. | Sospecha de red o indisponibilidad cloud. |
| `CHECKING_CONNECTIVITY` | No pasar silenciosamente a local; indicar verificación. | Pausar admisión de nuevas mutaciones mientras se drenan las ya iniciadas. | Online, Turso indisponible, offline seguro o bloqueado. |
| `CLOUD_UNAVAILABLE` | Error controlado de dependencia; no presentarlas como datos online actuales. | Bloqueadas; sin fallback local. | Recuperación cloud o corte de Internet confirmado. |
| `OFFLINE_ACTIVE` | SQLite solamente para el cajero autorizado. | SQLite + outbox atómica, allowlist estricta. | Recuperación, agotamiento/corrupción local o bloqueo. |
| `RECOVERING` | Vista local del cajero, rotulada como pendiente de reconciliación; demás clientes bloqueados. | Pausar temporalmente nuevas mutaciones de negocio. | Online solo después de verificar; offline si vuelve a caer y es seguro; bloqueo ante incertidumbre/conflicto. |
| `BLOCKED_UNSAFE` | Diagnóstico y consulta autorizada claramente rotulada, si la integridad lo permite. | Bloqueadas. | Resolución explícita; no limpiar pendientes para salir. |

`DB_MODE=local` debe seguir significando una instalación local independiente, no fingir Internet disponible ni sincronización. Mantener el comportamiento cloud-only actual si la funcionalidad nueva no está habilitada. Propuesta de activación: `CONTINGENCY_ENABLED=true` **junto con** `DB_MODE=cloud` y `APP_ROLE=CAJA_PRINCIPAL`. Validar combinaciones y fallar con explicación ante configuración incoherente.

### 4.1 Detectar el corte de Internet sin confundirlo con Turso

Implementar un servicio de conectividad, desacoplado del driver, con pruebas y reloj inyectables:

1. Una consulta Turso exitosa aporta evidencia positiva de conectividad.
2. Un fallo SQL, `SQLITE_CONSTRAINT`, `BLOCKED`, 401/403, 429, 5xx de Turso o agotamiento del pool no demuestra corte de Internet.
3. Ante error de transporte o señal de posible corte, pasar a verificación y ejecutar comprobaciones HTTPS acotadas desde **Node en la PC principal**, no solo desde el renderer.
4. Usar dos endpoints pequeños, controlados/aprobados e independientes de Turso; validar respuesta esperada, TLS, redirecciones y cache. `localhost`, health del propio backend o que la interfaz Wi-Fi esté activa no prueban salida a Internet.
5. Valor inicial sugerido: timeout de 3 s por comprobación, pruebas en paralelo y dos rondas fallidas separadas por unos 2 s. Parametrizar y comprobar tiempos con reloj falso. Si cualquier destino válido responde, no declarar Internet caído solo por fallar Turso.
6. Un proxy, portal cautivo, DNS filtrado o sondas bloqueadas pueden producir resultados ambiguos: usar `unknown` y bloquear el cambio inseguro en vez de concluir que no hay Internet.
7. Para entrar offline, exigir además la barrera de datos de la sección 8, no solo sondas fallidas.
8. Recuperar con evidencia positiva estable y verificación de Turso; que el navegador emita `online` no habilita escrituras.

**Límite importante:** ninguna combinación de sondas puede probar de forma absoluta la ausencia de Internet. Es una clasificación operativa con umbrales y fallos conocidos. Documentar falsos positivos posibles; ante ambigüedad conservar el modo seguro. No prometer detección infalible.

### 4.2 Costo y temporizadores

- Un solo monitor por backend principal; sin solapamientos.
- Reutilizar evidencia reciente de consultas exitosas; no probar cloud constantemente si el tráfico normal ya confirma disponibilidad.
- Para un backend ocioso, usar un intervalo acotado/configurable; referencia inicial 30 s. Durante una sospecha, acelerar solo la verificación; durante una caída, backoff con jitter y máximo aproximado de 30 s.
- Los clientes pueden consultar el estado **local** cada 5 s cuando estén visibles, sin que esa consulta dispare sondas cloud. SSE es opcional, no necesario para la primera versión.
- Detener intervalos al apagar; evitar acumulación tras reconexión, cambios de vista o StrictMode.
- Usar AbortController para cancelar trabajo real cuando la API lo soporte. `Promise.race` solo no cancela una solicitud subyacente.

---

## 5. Protocolo propuesto de persistencia y sincronización

### 5.1 Por qué hacen falta dos componentes

La cola de ventas offline no basta: para vender durante el corte hay que tener previamente usuarios, permisos, catálogo, stock, pedidos relevantes y sus relaciones actualizados. Por eso se necesitan:

1. **Espejo local:** copia consistente inicial y aplicación incremental de transacciones cloud confirmadas.
2. **Outbox local:** operaciones aceptadas offline y todavía no confirmadas en Turso.

Mantener el espejo mientras hay Internet no significa atender operaciones normales desde SQLite. El negocio online sigue en Turso; SQLite recibe mantenimiento en segundo plano o al confirmar una operación para quedar listo para un corte.

### 5.2 Unidad de sincronización

Sincronizar **operaciones de negocio completas**, no consultas aisladas:

- Crear pedido: cabecera, detalles, reservas de stock e idempotencia.
- Completar/entregar: los cambios que hoy realiza el servicio, incluyendo stock/insumos y venta cuando corresponda.
- Cancelar/quitar ítem: total, detalles, devoluciones o merma y demás efectos actuales.
- Movimiento de caja: alta o baja autorizada, una sola vez.

Cada operación lleva un `operation_id` estable, un hash canónico del pedido original, identidad de autor/equipo, versión de formato y conjunto de efectos. Los efectos describen exclusivamente las filas cambiadas, con IDs y valores definitivos; no todas las filas de una tabla.

**Decisión para este plan:** aplicar esos efectos confirmados, con precondiciones, durante la réplica y el replay. No volver a ejecutar ciegamente la lógica de venta contra precios/recetas/fecha de otro día. La lógica de negocio se ejecuta una vez en la base autoritativa del modo actual; la réplica transfiere su resultado. Validar claves foráneas, secuencia, hashes y estado esperado antes de aplicar efectos. El aplicador es interno y usa allowlist de tablas/columnas: no exponer un endpoint público que acepte SQL o parches arbitrarios.

### 5.3 Tablas nuevas, aditivas y versionadas

Los nombres siguientes son propuestos. Antes de crearlas revisar conflictos de nombres. No reutilizar silenciosamente los pendientes legados como si cumplieran este contrato.

**En Turso:**

- `sync_writer_state`: fila por ámbito de datos del comercio; `writer_id`, `generation`, `head_seq`, `schema_version`. `head_seq` avanza una vez por transacción de negocio confirmada.
- `sync_operations`: `operation_id` único, `seq` único, `writer_id`, `generation`, `actor_id`, `operation_type`, `request_hash`, `effects_hash`, versión de payload, efectos JSON y resultado estable de API, timestamps y datos mínimos de auditoría.
- El registro de operación, sus efectos de negocio y el avance de `head_seq` se confirman **en la misma transacción**. Si revierte el negocio, no queda una operación confirmada.

**En SQLite principal:**

- `contingency_state`: identidad estable, generación conocida, última secuencia cloud aplicada, estado/versión de bootstrap, sesión offline y metadata de recuperación. La readiness se deriva también de los registros, no solo de un booleano en memoria.
- `operation_outbox`: `operation_id` único, orden local monotónico, origen `online_intent` u `offline`, actor, tipo, request canónico/hash, efectos/hash si están resueltos, respuesta histórica, sesión, secuencia cloud base, generación base, estado, intentos, último error codificado y timestamps.
- Estados explícitos: por ejemplo `prepared`, `uncertain`, `pending`, `sending`, `acknowledged`, `conflict`. Distinguir intención online no resuelta de operación offline aceptada.
- Cursor del espejo y operaciones aplicadas se actualizan en la misma transacción local. Puede usarse una tabla de deduplicación local si hace falta.

Agregar índices para pendientes por estado/orden, `operation_id`, secuencia y sesión. No confiar en la hora de pared para ordenar, deduplicar o resolver conflictos. No podar operaciones o claves mientras existan reintentos/pendientes que dependan de ellas. Definir retención antes de agregar limpieza automática; inicialmente preferir conservar.

Los payloads contienen datos operativos sensibles. Restringir permisos del directorio local, no publicarlos en logs, no devolverlos a usuarios sin autorización y no incluirlos en informes públicos.

### 5.4 Captura de efectos, sin magia sobre Knex

1. Inventariar todas las mutaciones que afectan tablas espejadas, incluidas altas/ediciones/bajas online de catálogo, recetas, permisos y empleados.
2. Introducir un contexto explícito `{ db, trx, operationId, actorId, writerId, mode }` o equivalente.
3. Ejecutar el servicio con **una única transacción de la base elegida** y propagarla a todos sus repositorios. Resolver imports directos que escapen al contexto, incluidas `fn.now()` y consultas auxiliares.
4. En los lugares de mutación, recolectar explícitamente las filas afectadas/valores finales y eliminaciones, usando un helper público propio. Incluir efectos en cascada relevantes. Agrupar lecturas de filas afectadas; no hacer un barrido por cada cambio.
5. Registrar precondiciones de las filas modificadas y efectos ordenados. Capturar resultados realmente persistidos, incluyendo IDs generados y defaults, no solo el body HTTP.
6. Consolidar modificaciones repetidas a una misma fila dentro de la operación sin perder la precondición inicial ni el valor final.
7. Si la operación no modifica datos —por ejemplo entregar algo ya entregado— devolver el resultado idempotente sin crear un efecto de stock nuevo. Definir si registra un no-op sin avance del journal o solo recupera el resultado; mantenerlo consistente.
8. Las funciones de réplica no deben volver a capturar sus escrituras como nuevas ventas. Usar un camino interno explícito y separado del ejecutor de negocio.

El registro debe incluir **todas** las mutaciones online del dataset espejado. Si una ruta todavía no está integrada, no habilitar `localReady` como si el espejo estuviera completo. Durante el despliegue mantener la contingencia apagada hasta completar la cobertura.

### 5.5 Identidad, hash e idempotencia

- Mantener las claves actuales de `pedidoService` y mapearlas a la identidad nueva sin generar una segunda operación para el mismo intento.
- Todas las mutaciones permitidas offline deben tener una clave estable del cliente antes de salir por HTTP, no solo crear pedido. Reintentar con la misma clave hasta conocer el resultado; no regenerarla al recibir un 503 o reiniciar la UI.
- El hash de request incluye ámbito/actor, método/tipo, objetivo y payload canónico; no timestamps ni IDs aleatorios generados por cada intento. El hash de efectos es separado.
- Misma identidad con mismo hash: recuperar resultado confirmado. Misma identidad con otro hash: 409 de conflicto, sin efectos.
- El registro cloud de deduplicación debe poder resolver todas las operaciones admitidas: entregar, cancelar, quitar ítem, crear y borrar movimiento, no solo pedidos.
- La respuesta histórica distingue “ya aplicado” de “creado ahora”; no volver a imprimir/enviar acciones externas automáticamente por recibir un replay.
- No usar únicamente la existencia de `pedidos.id` para deduplicar otras operaciones sobre ese pedido.

---

## 6. Flujo online: conservar Turso y preparar una contingencia real

Con `CONTINGENCY_ENABLED=false`, conservar el modo actual. Con contingencia habilitada y ya preparada:

1. El ejecutor admite una mutación autenticada, valida permisos y mantiene la misma base durante toda la operación.
2. Persiste una **intención local durable** con su identidad, hash y request antes de enviar la escritura a cloud. Si el almacenamiento local falla, no enviar esa mutación en el modo híbrido prometiendo contingencia lista. Mostrar indisponibilidad/degradación explícita; el modo cloud-only puede seguir usándose si se elige conscientemente fuera de esta promesa.
3. Inicia transacción cloud y valida escritor/generación. Busca primero `operation_id`: si ya está confirmado con el mismo hash, recupera resultado; si cambió hash, aborta.
4. Ejecuta la lógica de negocio existente contra `trx` cloud, captura efectos y registra operación/resultado/seq en la misma transacción. La restricción única resuelve carreras; después de un conflicto único recuperar solo esa identidad, no cualquier error de integridad.
5. Tras COMMIT confirmado, aplica los efectos cloud al espejo local dentro de una transacción, actualiza cursor y cierra la intención.
6. Si el espejo falla pero cloud confirmó, no informar falsamente que la venta no ocurrió ni reenviarla como nueva. Retener intención, invalidar `localReady`, devolver la confirmación cloud si está disponible y mostrar estado de contingencia no lista hasta reparar. Un reintento con la misma clave recupera el resultado.
7. No iniciar una siguiente mutación que haga imposible reconstruir el orden. Usar una cola/barrera de admisión para el escritor en modo híbrido; no bloquear lecturas normales detrás de una venta y no serializar indiscriminadamente todo el servidor. Medir latencia y throughput.

### COMMIT incierto

Si se corta la respuesta después de enviar una mutación, Turso puede haberla confirmado. Guardar la intención como incierta y mantener su identidad. **No ejecutar ese intento en SQLite** y no responder “se guardó offline”.

Al recuperar cloud, consultar `operation_id`. Si existe y su hash coincide, recuperar efectos/resultado y actualizar el espejo. Si no existe, solo reintentar por el protocolo transaccional con la misma identidad; la consulta de ausencia aislada no elimina una carrera con un COMMIT anterior todavía en curso. La unicidad y el control de generación deben impedir el segundo efecto.

Mientras no pueda resolverse una intención capaz de cambiar la base del espejo, no declarar `localReady` ni aceptar ventas offline dependientes de ella. Esto reduce disponibilidad en un caso límite, pero evita vender dos veces o usar stock incorrecto. Explicar el bloqueo al cajero; no ocultarlo para que parezca que la contingencia siempre funciona.

---

## 7. Preparación inicial y mantenimiento del espejo

### 7.1 Bootstrap

1. Antes del primer corte, aplicar migraciones aditivas compatibles y preparar el journal cloud con la contingencia aún apagada.
2. Hacer un bootstrap controlado. Para la primera versión se permite una breve ventana de mantenimiento: bloquear nuevas mutaciones del coordinador, drenar las pendientes y asegurar que no hay otro escritor, scripts ni migraciones concurrentes.
3. Capturar generación, versión de esquema y `head_seq`. Leer por lotes con paginación por clave primaria todas las tablas necesarias, manteniendo datos constantes durante la ventana. Si se usa una transacción de lectura en vez de la pausa global, comprobar antes su soporte y límites reales en la versión Turso/libSQL instalada.
4. Escribir en una base local nueva/temporal, en orden de dependencias. No mezclar una copia a medias con la base activa. Conservar las claves foráneas y tratar ciclos con una estrategia compatible probada, no apagándolas.
5. Volver a comprobar generación/versión/head: si hubo escrituras fuera de la pausa, abortar el bootstrap y corregir la topología, no marcarlo listo.
6. Verificar conteos, IDs/relaciones y `PRAGMA foreign_key_check`/`PRAGMA integrity_check` en SQLite. Un conteo igual no prueba igualdad de valores: verificar también contenido con comparación/hash estable dentro del fixture o proceso de bootstrap.
7. Publicar la nueva base solo tras cerrar conexiones y finalizar correctamente. Mantener respaldo de la anterior si corresponde. Registrar cursor y versión; entonces liberar mantenimiento y activar incremental.
8. Sin bootstrap completo no hay contingencia operativa. No usar seeds de ejemplo como reemplazo del comercio real.

Incluir al menos roles/permisos, empleados necesarios para auth, categorías, productos, insumos, recetas/ingredientes, pedidos/detalles, ventas, mermas, movimientos y las demás tablas que realmente consultan los flujos admitidos. Construir inventario con las migraciones actuales; no confundir `usuarios` del README con la implementación efectiva basada en empleados.

### 7.2 Incremental cloud → local

- Leer operaciones confirmadas posteriores al cursor por rango de `seq`, con índice y lotes pequeños; referencia inicial 50 operaciones y límite de tamaño en bytes.
- Aplicar cada operación completa, junto con cursor/deduplicación local, de forma atómica.
- Una operación grande puede exceder el lote normal: no partir su transacción de negocio en confirmaciones parciales. Limitar payload o procesarla íntegra con backpressure.
- Las confirmaciones online pueden aportar directamente efectos al espejo, evitando volver a consultarlos; el journal permite recuperar después de un reinicio o error de espejo.
- Si hay un salto no explicado de secuencia, cambio de generación, esquema incompatible o historial eliminado antes del cursor, bloquear readiness. Rebootstrap solo por procedimiento controlado y **nunca sobre una outbox no vacía**.
- No permitir escrituras administrativas directas en cloud mientras la copia está habilitada. Si son necesarias, entrar en mantenimiento y rehacer/verificar el espejo antes de volver a habilitarlo.

### 7.3 Readiness real

Para `localReady=true`, exigir simultáneamente: bootstrap completo, esquema compatible, identidad/generación válidas, SQLite escribible/íntegro, últimas operaciones cloud conocidas aplicadas y ausencia de intenciones inciertas. Mostrar fecha de última actualización y motivo si no está lista.

La mera antigüedad cronológica no determina si faltan cambios: una caja sin ventas puede tener una copia antigua pero exacta. Lo importante es la secuencia y que no existan escritores externos. Si el cursor no coincide con la última operación cloud conocida, no habilitar offline por una tolerancia arbitraria de segundos.

---

## 8. Entrada en contingencia y operaciones permitidas

### 8.1 Barrera de transición

Al sospechar corte, el coordinador bloquea admisión de nuevas escrituras y deja terminar o clasifica las que ya estaban en curso. No cambiar de conexión a mitad de una transacción. La transición a `OFFLINE_ACTIVE` requiere:

- Corte clasificado como `unreachable`, no mero fallo de Turso.
- Equipo principal/identidad correctos, sin segundo escritor.
- Copia lista según sección 7.
- Ningún COMMIT cloud incierto ni operación cloud confirmada pendiente de aplicar.
- Ninguna corrupción o migración pendiente que invalide la copia.

Crear/persistir `offline_session_id`, secuencia/generación cloud base y modo de recuperación. El modo en memoria no es el único registro.

### 8.2 Política mínima de negocio offline

Definir una allowlist de rutas/métodos, no “todo lo que pueda hacer el cajero”:

**Dentro de la primera implementación:** crear pedidos; transiciones/completar/entregar según lógica existente; cancelar/quitar ítems con sus devoluciones/mermas; altas y bajas de movimientos de caja que el usuario ya tenga permiso de realizar. Lecturas necesarias de catálogo, pedidos y caja para ese cajero.

**Fuera del alcance offline inicial:** crear/editar usuarios o roles; cambiar permisos; editar catálogo, precios, recetas, proveedores e inventario manual; migraciones/seeds; subir archivos a Cloudinary; funcionalidades que dependan de servicios externos. Bloquearlas con código claro y UI coherente, no fingir que funcionaron.

La merma emitida por una cancelación admitida sí pertenece a la operación; no confundirla con habilitar toda la administración manual de mermas.

Si el negocio quiere quitar o ampliar esta allowlist, dejarlo explícito y agregar sus casos de pruebas. No anunciar “toda la aplicación offline” si existen funciones bloqueadas.

### 8.3 Una operación offline, paso a paso

1. Validar JWT vigente y permisos desde datos locales confiables. Verificar cajero designado y equipo principal; administrador no es excepción implícita.
2. Validar clave estable de operación e identificar replay local antes de modificar stock.
3. Abrir una transacción SQLite única.
4. Ejecutar la misma lógica de negocio con ese `trx`, usando datos del espejo. Generar IDs/fechas una sola vez y conservar resultados y efectos concretos.
5. Insertar outbox y deduplicación en esa **misma** transacción. Si falla outbox, revertir venta/stock/caja; si falla negocio, no guardar un pendiente como éxito.
6. Confirmar SQLite y devolver éxito local explícito: guardado en este equipo, pendiente de sincronizar, con `operation_id`.
7. Repetir la misma request debe devolver el resultado anterior sin efectos adicionales.

No depender de `sessionStorage` para conservar la venta: la outbox autoritativa vive en SQLite. Conservar claves de mutaciones en almacenamiento cliente hasta confirmación; si se pierde la respuesta, recuperar por identidad antes de permitir un envío nuevo equivalente.

---

## 9. Recuperación y replay hacia Turso

1. Confirmar conectividad estable a Internet y Turso; entrar en `RECOVERING`. No desbloquear a los demás usuarios todavía.
2. Pausar nuevas mutaciones de negocio por una barrera común. El worker sigue escribiendo solo por el protocolo interno autorizado.
3. Resolver intenciones online anteriores y revisar identidad/generación/versión cloud. Antes del primer pendiente offline, el head cloud debe coincidir con la base de la sesión una vez resueltas las operaciones conocidas. Si avanzó por un escritor externo, declarar conflicto; no aplicar postimágenes locales sobre datos nuevos.
4. Procesar outbox en orden local, con un solo worker. Al reiniciar, una fila `sending` no se asume perdida ni aplicada: recuperar por `operation_id`.
5. Para cada operación, abrir una transacción cloud: validar fencing; buscar deduplicación **antes** de exigir el head esperado, para reconocer un COMMIT propio cuya respuesta se perdió; comparar request/effects hash si existe.
6. Si es nueva, comprobar secuencia base/precondiciones, aplicar sus efectos en orden de dependencias y registrar operación/resultado/head en la misma transacción. Mantener foreign keys. No recalcular una venta al precio actual ni convertir el día offline al día de sincronización.
7. Tras confirmación remota, actualizar ack y cursor local de manera durable. Si la fila ya está aplicada localmente por la venta offline, **no volver a ejecutar sus efectos locales** al recibir su journal cloud; comprobar identidad/hash y avanzar metadata.
8. Si se pierde el ack después del COMMIT, el siguiente intento busca primero esa identidad y recupera la confirmación; no repite el descuento.
9. Falla de transporte: conservar pendiente, backoff/jitter y límites. Error de integridad, hash o generación: `conflict`, bloquear sucesores y mostrar motivo. Nunca pasar al siguiente como si nada ni borrar la fila.
10. Si la red cae nuevamente, no entrar offline con un envío `sending`/incierto. Resolver su resultado primero o permanecer bloqueado. Si no hay incertidumbre y la copia/base son coherentes, volver a contingencia conservando lo pendiente.
11. Solo al terminar: outbox sin pendientes ni inciertos, todos los acks persistidos, cursor/head coincidentes, misma generación y comprobación de invariantes de las filas afectadas. No hacer un checksum de todas las tablas por cada venta.
12. Persistir cierre de sesión offline y hora de sync exitosa; luego pasar a `ONLINE` y desbloquear. Mostrar “sincronización completada”, no solo “volvió Internet”.

### Idempotencia de DELETE y dependencias

Registrar tombstones/efectos de borrado con identidad y precondiciones. Si un DELETE ya quedó confirmado, recuperar su operación; la ausencia de una fila por sí sola no demuestra que ese DELETE esté sincronizado. Respetar orden entre crear pedido, completar, cancelar y borrar detalles. Una operación compuesta no queda parcialmente sincronizada.

### Pendientes antiguos

La tabla legada `sync_pendientes` no tiene por sí sola las garantías nuevas. Contar y exponer su existencia al operador autorizado; conservar respaldo y dejar su recuperación manual diferenciada. No migrar automáticamente un `UPDATE` viejo a un parche que sobrescriba cloud. No mezclar sus contadores con una outbox nueva vacía para mostrar una recuperación inexistente.

---

## 10. Autenticación, autorización y contrato HTTP

### 10.1 Backend primero

- Corregir la salida temprana de `checkRole` para el modo híbrido. El modo operativo y la autorización deben evaluarse juntos, no `databaseMode === cloud/local => next()`.
- Autenticar antes de decidir quién puede operar. Reutilizar `authRequired` y evitar dos verificaciones contradictorias. En modo híbrido de producción exigir `AUTH_ENABLED=true` y un secreto de JWT configurado; no permitir el usuario dev implícito.
- El requisito es **solo cajero de contingencia**, no “administrador o cajero”. Usar el rol canónico y la identidad designada; no inferirlo por nombre de rol, texto libre o flags manipulables del navegador.
- Validar contra el espejo confiable la cuenta vigente y su rol cuando corresponda. JWT expirado sigue expirado: no quitar la verificación para permitir trabajar offline. Permitir relogin local del cajero usando su hash bcrypt replicado, con el mismo control de credenciales y rate limiting que se defina para login; nunca guardar la contraseña en claro.
- Los demás usuarios deben quedar bloqueados en endpoints operativos offline, incluidas lecturas si la política de interfaz dice bloqueo total. Eximir explícitamente health/estado mínimo/login; no permitir una ruta por un `startsWith` que coincida con rutas no deseadas.
- Impedir dos asignaciones concurrentes de cajero mediante restricción transaccional/índice apropiado compatible con SQLite/Turso, además de la validación de formulario. Eso evita dos cuentas designadas, pero no sustituye el escritor único.
- El cliente no decide `req.isOnline`, base destino, escritor o lista de efectos mediante headers/body.

### 10.2 Estado y errores

Health debe distinguir liveness de readiness. Un 200 de “servidor vivo” no prueba salida a Internet ni base lista. El endpoint de estado es barato y expone un snapshot del coordinador, sin leer Turso por cada consulta.

Contrato orientativo:

```json
{
  "mode": "OFFLINE_ACTIVE",
  "internetStatus": "unreachable",
  "cloudStatus": "unknown",
  "localReady": true,
  "pendingCount": 3,
  "uncertainCount": 0,
  "lastSuccessfulSyncAt": null,
  "reason": "INTERNET_UNREACHABLE",
  "canOperate": true,
  "canOperateOffline": true
}
```

`canOperate` se calcula para el usuario autenticado. La vista pública, si se conserva, solo expone información mínima para pintar el bloqueo: no detalles de usuarios, outbox ni identidad completa del equipo.

Usar errores de máquina coherentes: `CLOUD_UNAVAILABLE`, `TURSO_QUOTA`, `CONNECTIVITY_UNKNOWN`, `OFFLINE_NOT_READY`, `OFFLINE_FORBIDDEN`, `SYNC_IN_PROGRESS`, `OPERATION_UNCERTAIN`, `SYNC_CONFLICT`, `WRITER_MISMATCH`, `LOCAL_STORAGE_UNAVAILABLE`. Pueden mantener los códigos actuales donde ya sean parte del contrato, documentando el mapeo. 403 para permisos; 409 para conflictos; 423/503 según bloqueo/transitoriedad, consistentemente.

El resultado incierto de una mutación debe conservar `operation_id` y el equivalente actual de `resultadoIncierto`, sin texto que invite a crear otra operación. Nunca transformar 503 en 401 ni borrar sesión por un fallo de conectividad.

`POST /sync/ejecutar` no acepta contenido SQL y no arranca workers paralelos. Debe estar autenticado/autorizado y solo pedir al coordinador un ciclo del mismo worker.

---

## 11. Frontend: estado correcto y mensajes honestos

1. Agregar un proveedor/hook de conectividad compartido, no un polling por pantalla.
2. Leer el estado del backend al iniciar, al recuperar foco y a intervalos locales acotados. Cancelar requests y timers al desmontar. Evitar toasts repetidos por cada petición fallida.
3. Tratar `navigator.onLine` y eventos `online/offline` como pistas para consultar al backend, no como autoridad. En LAN, una caja puede seguir disponible aunque el navegador del secundario marque offline.
4. Desde `api.js`, propagar códigos de error/estado del backend e impulsar un refresh del estado si hace falta. Un 500 SQL, 401, 403 de permiso normal o timeout de un componente no activa la contingencia.
5. Decidir si se conserva `nextbyte:network-status` con un emisor real o se elimina a favor del proveedor. No mantener dos fuentes contradictorias de estado.
6. Overlay para usuarios no autorizados mientras el coordinador esté offline/recuperando; no llamar a la base innecesariamente detrás del overlay. El backend también bloquea.
7. Cajero: distinguir “verificando”, “guardado local pendiente”, “sincronizando”, “sincronizado”, “servidor principal inaccesible” y “bloqueado por resultado incierto”.
8. “Reintentar conexión” pide una comprobación al coordinador, con rate limit/deduplicación. No basta con leer un health cacheado y proclamar éxito. Puede devolver 202/estado de verificación si el trabajo continúa.
9. No cerrar sesión ni limpiar carrito/intento por un 503. Conservar o recuperar claves de mutación de forma durable y rotular resultado incierto. No imprimir automáticamente otra comanda por un replay.
10. Deshabilitar funciones fuera de la allowlist offline y explicar por qué; las imágenes externas pueden no estar disponibles sin que eso invalide la venta local.
11. No decir “operando localmente” hasta que el backend confirme `OFFLINE_ACTIVE` y `localReady`.
12. No decir “todo normal” por recibir el evento `online`; esperar `ONLINE` después del replay.

---

## 12. Electron y arranque sin Internet

### Principal

1. Solicitar instancia única de Electron antes de arrancar el backend. Prevenir también dos procesos Node escritores sobre la misma SQLite mediante control de instancia/propiedad del directorio; un booleano global no protege dos procesos.
2. En `app.whenReady`, crear una subcarpeta de datos bajo `app.getPath('userData')` con permisos adecuados.
3. Configurar `LOCAL_DB_PATH` absoluto y rol antes de `require('../backend/src/index.js')`. Evitar SQLite dentro de `app.asar`, de la carpeta de instalación o del cwd.
4. Conservar identidad y base al actualizar/reinstalar normalmente. No copiar seeds sobre una base existente ni borrar WAL/SHM mientras está abierta.
5. Abrir/verificar local y levantar health/estado aunque Turso no responda. Intentar cloud con deadline; si hay bootstrap válido, datos seguros y corte confirmado, entrar a contingencia. Si falta alguno, abrir la interfaz con diagnóstico bloqueado, no una pantalla blanca.
6. Evitar conflicto silencioso en puerto 3000. Si está ocupado por otra app/instancia, no conectarse a un servidor desconocido solo porque devuelve 200; validar identidad de instancia/proyecto/rol en el handshake.
7. Cerrar worker, HTTP y conexiones ordenadamente, con timeout; la consistencia debe depender de transacciones durables, no de que siempre se ejecute el evento de cierre.
8. Probar el binario nativo SQLite y el empaquetado realmente instalado en Windows. No asumir que funciona porque pasó `node` en Linux. No cambiar `npmRebuild` a ciegas: usar la estrategia de módulos nativos de Electron compatible con la dependencia instalada y comprobar la salida.

### Secundaria

No iniciar un segundo backend escritor local con credenciales Turso. Cargar/configurar el frontend contra la URL LAN del principal. Si el principal está caído o el cliente está aislado de la LAN, bloquear y explicar; no promoverse solo.

### Navegador sin Electron

La contingencia requiere backend principal y SQLite accesibles. Un frontend hospedado en Internet que nunca se sirvió/cachéó localmente no va a abrir mágicamente con un corte. El alcance inicial no agrega una PWA independiente: servir frontend y API desde el principal o documentar claramente esa dependencia. Para acceso LAN, resolver HTTPS/WebCrypto antes de dar por aprobado el flujo de pedidos.

---

## 13. Orden de implementación y puertas de aceptación

No hacer todos los cambios de una vez. Cada paso debe dejar pruebas y un diff revisable.

### Paso 1 — Línea base y mapa de escritura

- Guardar el commit de partida y ejecutar las suites actuales, build y lint del frontend; registrar errores preexistentes sin atribuirlos al cambio nuevo.
- Medir consultas cloud y latencias del flujo de pedidos/comandas/caja con un dataset representativo.
- Inventariar mutaciones, tablas afectadas, transacciones y accesos que omitan `trx`.
- Confirmar topología de escritor único y configuración de principal/secundarias.

**Puerta:** no iniciar replicación sin saber quién escribe y qué tablas debe espejar.

### Paso 2 — Configuración opt-in y estado testeable

- Conservar cloud-only/local-only actuales.
- Introducir servicio de estado y conectividad, dependencias/reloj inyectables y códigos de error.
- Separar liveness/readiness y estabilizar contrato de estado.
- Todavía no dirigir operaciones a SQLite automáticamente.

**Puerta:** errores Turso sin corte nunca activan offline; tests de clasificación y timers pasan.

### Paso 3 — Migraciones aditivas y protocolo idempotente

- Agregar tablas/índices de escritor, journal, estado e intenciones/outbox.
- No modificar destructivamente migraciones históricas ya aplicadas.
- Probar migraciones en SQLite y Turso de prueba. Las reconstrucciones HTTP con `foreign_keys=OFF` ya están rechazadas por el driver; no quitar esa protección.
- Preparar migración controlada de producción, backups y verificación del esquema, sin activar migración automática cloud en cada arranque.

**Puerta:** rollback de negocio revierte journal; unicidad/hash y fencing probados.

### Paso 4 — Ejecutor por contexto y captura de efectos

- Refactor acotado de servicios/repositorios afectados para usar contexto explícito y una transacción.
- Integrar todas las mutaciones online del dataset; preservar lógica actual y queries agrupadas.
- Implementar intención previa, registro cloud y respuesta idempotente.
- No habilitar offline hasta completar el mapa de cobertura.

**Puerta:** suites de negocio existentes pasan; ninguna escritura se ejecuta en ambas bases como fallback.

### Paso 5 — Bootstrap y espejo incremental

- Implementar preparación controlada, publicación atómica y checks de integridad.
- Aplicar journal con cursor durable y deduplicación; reparar espejo desde intenciones sin repetir negocio.
- Exponer readiness y motivo de no preparación.

**Puerta:** comparación cloud/local exacta en fixtures; reiniciar a mitad de snapshot no publica una copia parcial.

### Paso 6 — Operación offline y control de acceso

- Aplicar barrera de transición, allowlist y auth del cajero.
- SQLite + outbox en la misma transacción.
- Ampliar claves estables a toda mutación admitida y recuperación de respuesta local perdida.

**Puerta:** no cajero y equipo secundario bloqueados también por API; cierre forzado no pierde ventas confirmadas localmente.

### Paso 7 — Worker de recuperación

- Orden, fencing, deduplicación antes del chequeo de head, retry/backoff y conflictos.
- Resolver COMMIT incierto y crash entre ack remoto/local.
- No reabrir hasta validar drenaje y cursores.

**Puerta:** los casos de pérdida de ack e interrupción de sincronización no duplican efectos.

### Paso 8 — Frontend

- Proveedor único, polling local, errores estructurados, overlay y mensajes de todas las fases.
- Conservar sesión, carrito y claves ante incertidumbre.
- Probar interacciones reales, no solo render de un cartel.

**Puerta:** corte WAN con Wi-Fi/LAN activa se refleja correctamente; `online` no desbloquea antes del sync.

### Paso 9 — Electron principal/secundaria y reinicios

- Ruta `userData`, instancia única, configuración de roles y arranque con cloud caído.
- Empaquetar e instalar en Windows; comprobar persistencia y módulo nativo.

**Puerta:** instalador real y navegador LAN completan escenarios manuales de la sección 15.

### Paso 10 — Regresión, rendimiento y entrega

- Ejecutar matriz completa, revisar diff, actualizar README/env y runbook.
- Comparar carga/latencia contra la línea base y justificar costo nuevo.
- Activar primero en entorno de prueba; producción solo con copia preparada, backup y prueba de corte/reconexión controlada.

**Puerta:** checklist final completo o pendientes declarados. No convertir tests fallidos en skipped para entregar.

---

## 14. Plan de pruebas automatizadas

### 14.1 Entorno seguro y comandos

Las pruebas no deben conectarse a producción ni cargar sus credenciales. Crear factories con configuración explícita para probar `cloud`, `local` y modo híbrido: `NODE_ENV=test` hoy fuerza modo test y puede ocultar bugs de producción. Separar tests unitarios de routing, integración con dos SQLite temporales y pruebas del adaptador remoto.

- Dos bases SQLite aisladas modelan origen/destino y permiten comprobar el protocolo, pero **no prueban por sí solas el transporte HTTP ni las transacciones reales de Turso**.
- Unit tests: timers/reloj falsos y fetch simulado para errores/sondas. No depender de tener Internet o de cortar la red real del runner.
- Integración: archivos temporales, reapertura en proceso nuevo y limpieza al terminar; no solo `:memory:` para persistencia tras reinicio.
- Verificación remota: una base Turso dedicada de prueba, con acceso explícito, datos sintéticos y misma versión/esquema. Nunca usar la base del local para ensayar fallos.

Comandos existentes de referencia, a ejecutar de nuevo tras implementar:

```bash
npm ci --prefix backend
npm test --prefix backend
npm test --prefix backend -- --runTestsByPath tests/databaseMode.test.js tests/sync.test.js tests/offline.test.js tests/health.test.js tests/libsqlKnexClient.test.js
npm ci --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
```

El frontend actual no declara runner de pruebas unitarias/E2E. Si se agregan, incorporar el runner mínimo compatible, configuración y scripts reales; documentar los comandos después de crearlos. No escribir en el informe que se ejecutó `test:e2e` si ese script no existe. Los tests de navegador deben comprobar comportamiento con backend simulado y, por separado, el circuito integrado.

### 14.2 Conectividad y estados

| ID | Caso/estímulo | Resultado exigido |
|---|---|---|
| N01 | Consulta cloud correcta. | Estado de disponibilidad positivo sin sonda adicional por cada request. |
| N02 | Turso devuelve 429, 5xx o `BLOCKED`; endpoints Internet responden. | `CLOUD_UNAVAILABLE`/cuota; **cero operaciones de negocio en SQLite**. |
| N03 | SQL inválido, constraint, error auth, pool timeout. | Error específico; no declarar corte de Internet. |
| N04 | DNS falla solo para Turso o conexión a ese host se rechaza. | No entrar offline si Internet tiene evidencia positiva. |
| N05 | Fallan dos rondas de sondas y Turso no es accesible; copia lista. | Transición a offline solo después del umbral y la barrera. |
| N06 | Falla una ronda y la siguiente responde. | Sin flapping y sin escritura local de negocio. |
| N07 | Portal cautivo, respuesta inesperada, TLS inválido o sondas bloqueadas sin diagnóstico confiable. | `unknown`/bloqueo; no tratar HTML de login como respuesta válida. |
| N08 | Renderer marca offline, Node tiene Internet/Turso. | No migrar el backend a SQLite por la señal del renderer. |
| N09 | Renderer tiene LAN/Wi-Fi activa, Node sin WAN. | El estado del backend activa la contingencia aunque `navigator.onLine=true`. |
| N10 | 20 clientes consultan estado cada 5 s. | No multiplicar sondas cloud/Internet por cliente. |
| N11 | Reiniciar monitor o desmontar/montar UI repetidamente. | Un solo timer/worker, sin fugas ni requests solapadas. |
| N12 | Turso vuelve antes/después de Internet o red oscila durante replay. | No liberar online prematuramente; preservar pendientes e inciertos. |

### 14.3 Routing, permisos y negocio

| ID | Caso/estímulo | Resultado exigido |
|---|---|---|
| R01 | Funcionalidad apagada, DB_MODE cloud/local. | Comportamiento anterior estable; no activar replicación. |
| R02 | Cambio de estado mientras hay transacción en curso. | Una operación usa una sola conexión/transacción; transición espera o bloquea. |
| R03 | Usuario no cajero invoca directamente POST/PATCH/DELETE offline con JWT válido. | Rechazo antes de modificar datos; no confiar en overlay. |
| R04 | Usuario no cajero consulta endpoints operativos offline. | Rechazo según política de bloqueo total, salvo excepciones explícitas. |
| R05 | Administrador que no es cajero. | No obtiene excepción offline implícita. |
| R06 | Cajero desde secundaria/segundo backend o escritor equivocado. | Sin segunda contingencia ni escritura cloud independiente. |
| R07 | Flags/headers/body manipulados para indicar rol, online o DB destino. | No alteran la autorización ni el routing. |
| R08 | JWT caduca durante el corte y cajero vuelve a loguearse. | Token vencido rechazado; login local válido contra hash replicado, sin desactivar auth. |
| R09 | Alta concurrente de dos cajeros designados. | Una sola asignación permitida, con garantía de base/transacción. |
| R10 | Cajero usa ruta fuera de allowlist: permisos, recetas, inventario o Cloudinary. | Error explícito, sin pendiente falso de éxito. |
| R11 | Dos intentos del último producto disponible, online y local por separado. | Solo el stock permitido se vende; nunca stock negativo ni cabeceras parciales. |
| R12 | Crear, completar, entregar, cancelar y quitar ítem. | Mismos invariantes de suites existentes, sin mover consumo/venta de etapa. |
| R13 | Cancelar vs entregar concurrentemente y entregar repetido. | Un estado final legal; una venta/merma/devolución como máximo según dominio. |
| R14 | Operación a las 23:59 offline y sync al día siguiente. | Misma fecha/hora, costo, precio y número operativo aceptados; sin reasignarlos por fecha de sync. |

### 14.4 Atomicidad, espejo e idempotencia

| ID | Caso/estímulo | Resultado exigido |
|---|---|---|
| D01 | Falla insertar outbox después de cambiar stock local. | Rollback completo: ni pedido ni stock ni pendiente parcial. |
| D02 | Falla registro cloud del journal después de negocio. | Rollback cloud completo; no venta sin operación/cursor. |
| D03 | Mismo operation_id/request varias veces; luego mismo ID con body distinto. | Un solo efecto; después 409, sin modificar datos. |
| D04 | Pierde respuesta tras COMMIT cloud, antes de ack local. | Intención incierta; al resolver, un solo efecto y resultado recuperado. |
| D05 | Corte con intención online no resuelta. | No vender su reemplazo en SQLite ni declarar copia lista. |
| D06 | Falla espejo local tras confirmación cloud. | Venta cloud sigue existiendo; readiness falsa; reparación por journal sin repetir negocio. |
| D07 | Proceso cae tras venta local confirmada. | Al reabrir archivo, venta, efectos y outbox siguen íntegros y ordenados. |
| D08 | Bootstrap interrumpido a mitad. | Copia parcial no se publica ni habilita offline; base anterior conservada. |
| D09 | Catálogo/stock/permisos cambian online y luego hay corte. | Espejo contiene los cambios confirmados; si no llegó a aplicarlos, offline bloqueado. |
| D10 | Cambio de receta/precio después de una venta offline. | No recalcular la venta; si indica escritor externo/generación divergente, conflicto explícito. |
| D11 | Reaplicar el mismo tramo de journal o reiniciar al actualizar cursor. | Ninguna duplicación; filas y cursor se confirman juntos. |
| D12 | Snapshot y mutaciones concurrentes no autorizadas. | No se acepta snapshot inconsistente; mantenimiento/cursor detectan la violación conocida. |
| D13 | Cascadas de DELETE y relaciones entre pedido/detalles/venta/merma. | FK válidas; efectos completos; no resucitar filas borradas por un replay. |
| D14 | Generación o schema version cambian; journal tiene gap. | Bloquear/reparar explícitamente; no resetear cursor u outbox a cero. |
| D15 | SQLite no escribible/corrupto o sin espacio durante transacción. | Error controlado y no éxito offline; transacción revierte y readiness se invalida. |
| D16 | Pendientes legados presentes. | Se conservan y se reportan por separado; no se marcan sincronizados automáticamente. |

Para D15 simular errores del almacenamiento de forma controlada y verificar luego con reapertura; no llenar el disco de desarrollo ni corromper una base real.

### 14.5 Replay, conflictos y reinicios

| ID | Caso/estímulo | Resultado exigido |
|---|---|---|
| S01 | Crear pedido offline, completar/entregar y mover caja; sync normal. | Mismos IDs y efectos en cloud/local, un solo registro de venta y movimiento. |
| S02 | Replay con respuesta perdida después de COMMIT. | Buscar identidad primero; no fallar por head ya avanzado por esa misma operación ni aplicar dos veces. |
| S03 | Proceso cae con fila `sending`, luego arranca. | Recuperar por operation_id, no asumir que faltó ni descartar la fila. |
| S04 | Red cae entre operación 2 y 3 de 5 pendientes. | Acks 1/2 durables; 3 se resuelve idempotentemente; 4/5 esperan. |
| S05 | Dos clics en “sincronizar” más worker automático. | Un solo ciclo/cola de ejecución, sin transacciones duplicadas. |
| S06 | Otra identidad intenta escribir cloud; cambia generation/head. | Fencing/conflicto; no sobrescribir con postimágenes viejas. |
| S07 | Falla una operación por constraint/hash. | Se detiene esa cadena; sucesoras no se omiten ni marcan éxito. |
| S08 | Nace una venta mientras se anuncia recuperación. | La barrera la acepta en un modo definido o la pausa; no se pierde entre bases. |
| S09 | Sync de DELETE, cancelación, merma y movimiento borrado. | Deduplicación por operación y efectos correctos, no por mera existencia de fila. |
| S10 | Retry con backoff y apagado. | Sin loop caliente ni spam de Turso; timers cancelados al cerrar. |
| S11 | Todos los acks recibidos, cursor local atrasado o intención incierta. | No mostrar `ONLINE` hasta completar la reconciliación real. |
| S12 | Replay devuelve journal de operación offline ya aplicada localmente. | Solo ack/metadata; no descontar stock local por segunda vez. |

### 14.6 Frontend y empaquetado

Comprobar con navegador y, cuando corresponda, Electron:

- Overlay de usuario normal vs vista operativa del cajero con el mismo estado backend.
- Sesión y carrito conservados con 503; 401 real mantiene su tratamiento de autenticación.
- Claves estables en cancelar/quitar/entregar/caja al perder respuesta; botón no permite fabricar otra operación para el mismo intento incierto.
- Banner offline solo tras confirmación del backend; banner “sincronizado” solo tras drenaje verificado.
- Backend inaccesible no se confunde con Turso caído ni con SQLite lista.
- Reintentar pide chequeo real y no genera ráfaga de sondas al clickear repetidamente.
- Cero toasts duplicados por cada componente fallando, polling suspendido en pestaña oculta según diseño y cleanup correcto.
- Relogin local del cajero y rechazo del no cajero.
- Build y lint sin regresiones; prueba real de HTTPS/WebCrypto desde un secundario LAN.
- Instalación Windows en ruta normal con permisos limitados, SQLite en `userData`, módulo nativo operativo, segunda instancia rechazada y datos conservados al actualizar.

### 14.7 Oráculo de integridad de los fixtures

No basta con que HTTP devuelva 200. Para cada escenario integrado comparar valores antes/después y entre ambas bases:

- IDs, relaciones y cardinalidad de pedidos/detalles, estado final y total.
- Stock de productos y cantidades de insumos exactamente según el negocio actual.
- Una venta por pedido cuando corresponde, sin duplicar costo/total.
- Mermas/devoluciones y movimientos de caja, con signo/monto/fecha correctos.
- Outbox, operación cloud, hashes, generación y cursores coherentes.
- `PRAGMA foreign_key_check` sin resultados y `integrity_check` correcto en SQLite de prueba.
- Precios/costos/fechas históricos idénticos; ninguna reasignación de IDs o numeración al sync.

En los fixtures chicos, comparar todas las filas relevantes normalizadas. En producción no hacer un barrido completo después de cada venta.

### 14.8 Rendimiento y ausencia de regresiones

Medir antes/después con el mismo dataset y acciones: abrir pedidos, crear uno con varios ítems, listar/cambiar comandas, entregar, abrir caja, crear/borrar movimiento, con varios clientes consultando.

Registrar cantidad de requests/consultas remotas por operación, tamaño de lotes, p50/p95 de latencia, fallos, memoria y cola del pool. Definir el presupuesto numérico con la línea base y el dueño antes de afirmar “no degradó”. Criterios mínimos:

- Lecturas habituales no obtienen una sonda cloud extra por request.
- Estado/UI no genera consultas remotas por cliente.
- Sin barridos completos por venta o por intervalo de sync.
- Costo del journal proporcional a filas afectadas y lotes pendientes.
- Sin aumento del pool ni retiro de índices para alcanzar el resultado.
- Con función desactivada, sin trabajo de réplica nuevo.
- En un ensayo representativo sano no aparecen nuevas clases de error; no prometer que ningún proveedor fallará nunca.

---

## 15. Prueba manual obligatoria de punta a punta

Usar datos sintéticos y una base de prueba. Guardar captura/video y conteos comparativos sin credenciales ni datos personales.

### Escenario A — Online estable

1. Instalar/abrir el principal y un cliente secundario con usuario no cajero.
2. Preparar bootstrap, comprobar `localReady` y cursor/head coincidentes.
3. Crear pedidos, modificar estados, entregar y registrar caja desde usuarios habilitados.
4. Verificar datos en Turso/espejo y ausencia de pendientes; comparar costo contra línea base.

### Escenario B — Corte WAN manteniendo LAN y Wi-Fi

1. Cortar la salida WAN del router o una regla equivalente para el backend principal, conservando la LAN. **DevTools Offline del renderer no equivale a esto:** Node puede conservar Internet.
2. Comprobar que se detecta el corte aunque el navegador siga `onLine=true`, dentro del plazo documentado por los intervalos configurados.
3. Usuario no cajero bloqueado tanto en pantalla como al llamar API directamente.
4. Cajero crea dos pedidos, completa/entrega uno, cancela o quita ítem del otro y registra un movimiento permitido.
5. Verificar éxito local, stock/venta/caja y outbox en SQLite, sin escrituras exitosas de negocio en cloud durante el corte.
6. Cerrar forzosamente la app después de un éxito local confirmado; abrir de nuevo aún sin WAN. Los datos y pendientes deben seguir disponibles y permitir continuar solo si son seguros.

### Escenario C — Reconexión interrumpida

1. Restaurar WAN; observar `RECOVERING`, no desbloqueo instantáneo.
2. Cortar otra vez durante un envío; volver a conectar.
3. Verificar que cada operación se aplicó una vez, incluso si se perdió un ack.
4. Concluir con outbox drenada, sin inciertos, cursores iguales e integridad correcta.
5. Solo entonces liberar al secundario y mostrar normalidad.

### Escenario D — Turso caído con Internet sano

Simular error/transporte solo hacia Turso o usar stub de prueba, dejando sondas Internet sanas. Mostrar indisponibilidad cloud y **no permitir ventas en SQLite** por ese motivo. Repetir con 429/cuota, 5xx, credenciales inválidas y constraint. Cada error conserva su clasificación.

### Escenario E — Instalador Windows y servidor inaccesible

Probar arranque sin WAN con copia válida, arranque sin copia, segunda instancia, ruta de instalación protegida y actualización. Aislar luego al secundario de la LAN: debe mostrar servidor principal inaccesible, no abrir una caja autónoma. Verificar que la app no confunda otro proceso en puerto 3000 con su backend.

### Escenario F — Resultado incierto

Con inyección controlada, confirmar una escritura cloud y perder la respuesta antes del ack local. Verificar que no se crea su reemplazo offline, que se conserva identidad/diagnóstico al reiniciar y que al recuperar cloud queda un único efecto. Este caso no se sustituye por “apagué el Wi-Fi y vendí”: es una ventana de fallo diferente.

---

## 16. Despliegue, operación y recuperación segura

1. Backup consistente de Turso y de bases locales existentes antes de migrar. No copiar solo el archivo `.db` abierto ignorando WAL; usar backup SQLite compatible o cerrar/checkpoint según procedimiento probado.
2. Revisar pendientes legados y conservarlos; documentar que no se recuperan automáticamente.
3. Aplicar migraciones nuevas en entorno de prueba y luego con ventana controlada en producción. No ejecutar seeds ni `reset-db` como reparación.
4. Habilitar protocolo de escritura/journal en el único principal; terminar bootstrap y verificar todas las puertas antes de permitir offline.
5. Configurar secundarias/HTTPS/roles y retirar credenciales escritoras sobrantes.
6. Mostrar a operador si contingencia está lista y desde qué actualización; no esperar al primer corte para descubrir que faltaba el espejo.
7. Mantener logs de transición, IDs de operación, cantidad de pendientes, códigos y duración/reintentos. No loguear tokens, secretos, contraseñas, requests completos ni datos sensibles de clientes.
8. Ante conflicto: bloquear, respaldar y revisar operación/base/generación. No borrar outbox, no saltar filas y no copiar toda la local sobre cloud.
9. Ante reemplazo de PC: detener al dueño anterior y recuperar sus pendientes antes de registrar nueva generación. No clonar `writer_id` y dejar ambos activos.
10. Rollback de código/configuración: si hay pendientes nuevos, **no volver a la versión vieja como si no existieran**. Conservar esquema y datos, bloquear escrituras riesgosas y usar una versión compatible que pueda resolverlos. Desactivar la feature solo después de drenar o recuperar explícitamente.
11. No borrar historial de deduplicación antes de vencer todas las ventanas de retry y respaldo compatibles. La limpieza es una tarea posterior con pruebas propias, no parte de “hacer que sincronice”.

---

## 17. Checklist final de aceptación

- [ ] Se conservan dialecto, índices, consultas agrupadas, timeout y política de no repetir escrituras automáticamente.
- [ ] Cloud-only/local-only conservan su comportamiento al deshabilitar la feature.
- [ ] Hay un solo backend/equipo escritor; las secundarias no se autopromueven.
- [ ] Turso caído con Internet sano no activa contingencia.
- [ ] El corte WAN con LAN activa sí se detecta desde el backend.
- [ ] Un resultado ambiguo no se convierte en otra venta local.
- [ ] Espejo real, inicial e incremental, con readiness y cobertura completa de mutaciones online.
- [ ] Venta offline y outbox son una única transacción durable.
- [ ] Autorización del cajero aplicada por backend, sin excepción implícita de administrador.
- [ ] Todas las mutaciones offline tienen identidad estable, deduplicación y respuesta recuperable.
- [ ] Replay conserva IDs, stock, ventas, mermas, caja y fechas; no reejecuta negocio ni recaptura réplica.
- [ ] Pérdida de ack, reinicio y caída durante sync no duplican efectos.
- [ ] Fencing, conflictos, esquema incompatible y pendientes legados se manejan explícitamente.
- [ ] Nadie se desbloquea por el mero evento `online`.
- [ ] SQLite persistente fuera del ASAR; instalador Windows probado.
- [ ] Suite completa y pruebas nuevas pasan; build/lint sin regresiones no explicadas.
- [ ] Rendimiento comparado con línea base y presupuesto acordado, sin disparar consultas.
- [ ] Evidencia manual de corte, reinicio, recuperación y fallo exclusivo de Turso.
- [ ] README, env de ejemplo y runbook reflejan exactamente lo implementado.
- [ ] Entrega enumera cambios, comandos ejecutados, resultados y pendientes sin exagerar garantías.

## 18. Formato de entrega que debe usar la IA implementadora

Entregar: resumen del diseño efectivamente aplicado; archivos cambiados; esquema y procedimiento de migración; variables nuevas sin valores secretos; configuración principal/secundaria; lista de funciones admitidas/bloqueadas offline; tests/comandos con resultados reales; evidencia manual publicable; medición de rendimiento; limitaciones y protocolo de recuperación.

No decir “listo” solamente porque compila o porque aparece el cartel. No afirmar que se ensayó Electron/Turso real si solo se usaron mocks o SQLite de prueba. Las pruebas existentes que esperaban sincronización deshabilitada deben ajustarse **solo en el modo nuevo habilitado**, manteniendo tests de seguridad y del modo cloud-only; no eliminarlas para esconder regresiones.

---

## 19. Referencias y límites

- MDN, `navigator.onLine`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine — indicador inherentemente no fiable para determinar acceso real a Internet; una LAN puede mantenerlo en `true`.
- Electron, ASAR: https://www.electronjs.org/docs/latest/tutorial/asar-archives — archivo de solo lectura; no usarlo como almacenamiento SQLite escribible.
- Electron, `app.getPath`: https://www.electronjs.org/docs/latest/api/app#appgetpathname — ubicación de datos de usuario y recomendación de subcarpeta propia.
- Contrato local de versiones: `backend/package-lock.json`, `frontend/package-lock.json`, `package-lock.json`, `libsqlKnexClient.js` y sus tests. Verificar allí antes de usar APIs que figuren solo en documentación de versiones nuevas.

La propuesta es una sincronización explícita de aplicación; no asume que `@libsql/client` HTTP ya proporciona réplica bidireccional offline. No agregar `syncUrl` o llamar a un supuesto `.sync()` sin confirmar soporte de la variante/runtime y, especialmente, de escrituras desconectadas. Una réplica local solo de lectura no cumple el requisito.

La garantía de consistencia de este alcance depende del escritor único, de no modificar cloud por fuera del protocolo y de bloquear la incertidumbre. Si se pide operación simultánea multi-sede, escrituras directas externas, relevo automático de caja o disponibilidad offline aun con COMMIT incierto, se necesita un diseño adicional: no presentar este plan como si resolviera esos problemas distribuidos sin restricciones.
