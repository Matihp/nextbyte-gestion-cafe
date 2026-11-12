# Corrección del espejo Turso → SQLite: diagnóstico sobre los commits nuevos

**Proyecto:** NextByte Café.  
**Fecha de revisión:** 12 de noviembre de 2026.  
**Código analizado:** `origin/main`, commit `ae3970b`, obtenido del remoto durante esta revisión.  
**Cambios nuevos revisados:** `bcf43e0`, `962b005` y `ae3970b`.  
**Alcance de esta entrega:** diagnóstico y especificación para implementar; no se modificó código de la aplicación ni la base del comercio.

> **Conclusión:** el motor de sincronización ya existe, pero el recorrido online real no lo alimenta. Hay una copia parcial de pedidos que se inicia antes del COMMIT, sin espera ni recuperación durable, y no se mantiene un espejo completo mientras la aplicación sigue online. No alcanza con aumentar la frecuencia de sincronización: primero hay que registrar y capturar todas las mutaciones confirmadas.

Este documento actualiza el diagnóstico anterior. **No empezar de cero ni restaurar el sistema viejo:** integrar y corregir las piezas nuevas preservando las mejoras online.

---

## 1. Qué revisé y qué está demostrado

### 1.1 El archivo adjunto

El archivo recibido `PLAN_CONTINGENCIA_OFFLINE_Y_SINCRONIZACION.md` coincide **byte por byte** con el plan anterior de esta conversación. No contiene una actualización de etapas implementadas. Esto no invalida tus avances: están en los tres commits nuevos, que sí se revisaron.

Del documento previo siguen vigentes especialmente estas obligaciones: registro transaccional cloud, espejo solo después del COMMIT, copia incremental, outbox atómica y readiness verificada. El problema actual es que varias de esas obligaciones tienen funciones creadas, pero no están conectadas con la ejecución real o quedan anuladas por caminos alternativos.

### 1.2 Método de revisión

El workspace de esta conversación seguía en el commit viejo. Para no confundir versiones ni tocar tu rama, se actualizó la referencia remota y se inspeccionó/ejecutó una copia aislada de `ae3970b`. No se hizo checkout, merge, commit, push ni modificación del backend/frontend/Electron.

Las reproducciones usaron servicios actuales y **dos SQLite de prueba**, una como origen lógico y otra como espejo. No se usaron Turso real, el instalador de Windows ni datos del comercio. Esto demuestra fallos del flujo de aplicación, no las propiedades del transporte remoto.

### 1.3 Reproducción A: crear online y entregar

Fixture: ambas bases empiezan con el mismo producto y stock 10. Se llama al servicio real de crear pedido con dos unidades y clave de idempotencia, se espera a que termine su copia asíncrona y luego se llama al servicio real de entregar.

| Dato después de la operación | Origen lógico online | SQLite espejo |
|---|---:|---:|
| Pedidos | 1 | 1 |
| Stock del producto | **8** | **10** |
| Estado del pedido | **entregado** | **pendiente** |
| Registros de venta | **1** | **0** |
| Operaciones en `sync_operations` | **0** | **0** |

Esto explica un matiz importante de tu síntoma: no necesariamente falta **toda** escritura online en SQLite. Puede copiarse la cabecera inicial, pero faltan stock, estado, venta y cambios posteriores. Un pedido visible no significa que la base esté sincronizada.

### 1.4 Reproducción B: rollback después de ejecutar el negocio

Se inyectó, únicamente en el arnés de prueba, un error después del callback de negocio y antes del COMMIT del origen. Se ejecutó el rollback real de SQLite del origen y se dejó terminar la copia asíncrona ya disparada por el servicio.

Resultado:

```text
Origen: 1 pedido — conserva solamente el pedido anterior confirmado.
Espejo: 2 pedidos — incluye el intento que el origen revirtió.
```

Es un **pedido fantasma**: la copia local puede adelantarse a la confirmación de la base principal. En producción podría aparecer también al fallar un COMMIT; esa ventana específica del transporte Turso no se ensayó aquí, pero copiar dentro del callback ya es incorrecto por sí mismo.

### 1.5 Pruebas existentes: resultado real, sin confundirlo con la funcionalidad nueva

- El comando normal `npm test` **no arranca** en el commit remoto: `backend/package.json` referencia `tests/helpers/setupEnv.js`, que no está versionado.
- Para diagnosticar sin editar archivos, se ejecutó Jest con una configuración explícita equivalente en entorno de prueba, sin ese hook inexistente.
- Las cinco suites focalizadas dieron **108/108**.
- La suite completa dio inicialmente **446/448**: dos fallos de fechas por diferencia de zona horaria. Al repetirla con `TZ=America/Argentina/Buenos_Aires`, dio **448/448, 24 suites**.
- Esos resultados alternativos no arreglan el comando oficial ni prueban la nueva contingencia: los commits nuevos no agregan tests, y `NODE_ENV=test` desactiva el contexto/routing híbrido real.

No anunciar “la sincronización está validada” porque esas suites pasan. La reproducción A falla semánticamente aunque las 448 pruebas existentes estén verdes.

---

## 2. Diagnóstico causal, ordenado por prioridad

Las líneas citadas corresponden a `ae3970b`. Después de editar se moverán: buscar también las funciones y condiciones indicadas.

### P0-A — El ejecutor de mutaciones existe, pero nadie lo usa

**Archivos:** `backend/src/services/mutationExecutor.js`, servicios de negocio.

`runBusinessMutation` contiene registro cloud y aplicación al espejo, pero no se encontraron llamadas desde controladores/servicios del negocio. `recordCloudOperation` solo se llama desde ese ejecutor. Los pedidos y comandas siguen usando sus transacciones directas y hooks particulares.

**Consecuencia:** una venta online no crea su operación cloud ni avanza el journal. Un worker incremental no puede descubrir modificaciones que nunca fueron registradas.

**Además:** `runBusinessMutation` tiene `localDb = null` por defecto; la réplica de líneas 140–158 solo corre si se le entrega una conexión. Integrar la función sin proporcionar/inicializar la conexión real tampoco resolvería el problema.

### P0-B — La copia online de pedidos está en el lugar incorrecto

**Archivo:** `backend/src/services/pedidoService.js:226–260`, dentro del callback de `dbLocal.transaction`.

La función autoejecutable asíncrona:

- Se lanza sin `await` antes de que Knex confirme el COMMIT.
- Inserta cabecera y detalles en operaciones locales separadas, sin transacción común.
- No replica la reserva de stock de productos.
- No actualiza una cabecera que ya existe.
- No deja cursor, identidad de réplica ni tarea durable de reparación.
- Descarta los errores con `catch {}` y `.catch(() => {})`.

**Consecuencias:** cambios faltantes, copias parciales, falta de diagnóstico, carreras y pedidos fantasmas demostrados en 1.4.

**No alcanza con ponerle `await`:** seguiría copiando dentro de una transacción cloud sin confirmar y conservando dos bases sin un protocolo de recuperación.

### P0-C — El espejo no tiene mantenimiento online efectivo

**Archivos:** `backend/src/services/bootstrapService.js:191–245`, `recoveryWorker.js:248–265`, `jobs/syncJob.js`, `config/contingencyDb.js:52–115`.

`applyIncrementalJournal` existe, pero se llama al final del recovery. No hay un consumidor cloud→local continuo integrado a las mutaciones online. El bootstrap/refresco se hace al arrancar; no cubre cambios posteriores de la sesión.

**Consecuencia:** reiniciar conectado puede disimular el problema reconstruyendo una copia, pero no garantiza que la próxima caída tenga los cambios de los últimos minutos.

### P0-D — Readiness puede ser un falso positivo

**Archivo:** `backend/src/config/contingencyDb.js`.

- `isContingencyReady`, líneas 47–50, solo comprueba que exista el archivo.
- En líneas 112–113, una excepción puede terminar en `ready: true`.
- Un `bootstrap_status=READY` dice que hubo una copia inicial, no que se aplicaron las ventas posteriores.

**Archivos relacionados:** `recoveryWorker.js:248–265`, `mutationExecutor.js:149–156`.

- El recovery ignora el error de aplicar journal y luego publica `ready: true` y `ONLINE`.
- El ejecutor, si falla la copia, informa `lastCloudSeq: cloudSeq`, aunque esa secuencia todavía no se aplicó correctamente en SQLite.

**Consecuencia:** la interfaz puede autorizar contingencia con datos atrasados o incompletos. Este falso éxito es más peligroso que mostrar un error de sincronización.

### P0-E — La captura de efectos está incompleta en ambos sentidos

**Archivos:** `pedidoService.js`, `comandaService.js`, `cajaService.js`, servicios de administración.

- Online no se registran en un protocolo común pedido, stock, cambios de estado, ventas, caja, cancelaciones y edición del catálogo/permisos.
- Los hooks offline de completar/entregar (`comandaService.js:271–293,334–356`) capturan el estado del pedido, pero omiten la fila de `registro_ventas` que puede generarse en la misma transacción.
- Cancelar/quitar ítem y caja no se integran al ejecutor nuevo.
- Los hooks particulares capturan errores de outbox y permiten continuar. Una venta local puede confirmarse sin dejar una operación sincronizable.
- Algunas claves de comanda se fabrican con `Date.now()`: no son la misma identidad si el cliente reintenta después de perder la respuesta.

**No dar por perfecto el sentido local→online:** puede verse el pedido y faltar su registro de venta, devolución, merma o caja. La percepción de mejora es válida; la equivalencia de toda la operación todavía no está garantizada.

### P1-A — Cursor y aplicador permiten ocultar inconsistencias

**Archivos:** `bootstrapService.js:203–238`, `operationJournalService.js:161–179`.

- El incremental consume un lote máximo de 50 por llamada; falta un drenaje verificado hasta un head objetivo.
- El aplicador de INSERT ignora una fila existente sin comparar su contenido.
- UPDATE puede afectar cero filas y la operación igual considerarse aplicada.
- DELETE no comprueba la precondición esperada.
- El aplicador no utiliza `previousData`, y el incremental no valida hash de efectos, versión de payload, identidad/generación cloud.

No arreglar UPDATE haciendo un upsert indiscriminado: si una fila falta porque se perdió una operación anterior, hay que detectar y reparar esa pérdida, no inventar una fila parcial.

### P1-B — Health y señales de conectividad no deben decidir que terminó la réplica

**Archivo:** `backend/src/app.js:29–59`.

El endpoint consultado por la interfaz puede abrir pruebas cloud y disparar recovery; también fuerza `ONLINE` en determinadas ramas. Esto mezcla liveness, conectividad y finalización de datos y multiplica trabajo con más clientes.

**Cambio necesario:** un coordinador único hace las transiciones y el trabajo. Health/estado devuelve una instantánea barata y coherente. Que `SELECT 1` responda no demuestra que el espejo tenga la última venta.

---

## 3. Qué conservar de lo que ya funciona

1. El dialecto `LibsqlKnexClient`, su timeout, su cierre de conexiones y la regla de no reintentar escrituras automáticamente.
2. Pool cloud acotado, consultas agrupadas, índices y protecciones de stock/transiciones/idempotencia existentes.
3. Las tablas nuevas de contingencia/journal/outbox, con migraciones aditivas si falta algún campo. No cambiar destructivamente migraciones ya aplicadas.
4. `EffectCollector`, bootstrap e incremental como bases reutilizables, corrigiendo sus contratos; no sustituirlos por copiar toda la base tras cada venta.
5. El worker único de recovery, manteniendo y mejorando su deduplicación y orden.
6. La ruta SQLite bajo `userData` y la instancia única agregadas en Electron.
7. La mejora visual y el polling compartido, sin atribuirles persistencia que le corresponde al backend.

Mantener la feature opt-in. `CONTINGENCY_ENABLED=false` debe seguir usando el camino cloud/local independiente actual, sin escribir journal ni abrir SQLite de contingencia por accidente.

No actualizar dependencias, subir el pool, quitar índices, eliminar tests o cambiar el ciclo de negocio para resolver este bug.

---

## 4. Diseño concreto de la corrección

### 4.1 Un solo camino de mutación

Conectar los servicios reales a `runBusinessMutation` y convertirlo en la única frontera de persistencia para las mutaciones del modo híbrido.

No envolver el servicio actual que ya abre `dbLocal.transaction` con otra transacción. Separar su cuerpo en una función que reciba `{ trx, collector, operationId, actorId, mode }` y reutilice ese `trx` en todos los repositorios.

**Regla central:**

```text
ONLINE:
intención local durable
→ transacción cloud { negocio + efectos + journal + head }
→ COMMIT cloud confirmado
→ transacción local { efectos confirmados + cursor + cierre de intención }
→ resultado coherente y readiness real

OFFLINE:
transacción SQLite { negocio + efectos + outbox + deduplicación }
→ COMMIT local
→ éxito explícitamente pendiente de sincronización
```

La transacción cloud y la local no son una transacción distribuida. Hay que tolerar que una confirme y la otra falle, usando identidad, journal e intención durable. No intentar simular atomicidad entre ambas con `Promise.all`.

### 4.2 Qué debe registrar cada operación

Registrar filas reales persistidas, IDs definitivos, fechas/costos históricos y efectos completos:

| Operación | Captura mínima, según lo que realmente haga el negocio actual |
|---|---|
| Crear pedido | Cabecera, detalles y valores finales de stock de los productos afectados; claves de idempotencia. |
| Cambiar estado | Estado y demás columnas persistidas del pedido. |
| Completar/entregar | Estado y fila de venta si se crea, con su ID y valores definitivos; cualquier otro efecto real de esa ruta. |
| Cancelar/quitar ítem | Bajas/ediciones de detalles, total/estado del pedido, devolución de producto o merma con su ID. |
| Caja | Movimiento insertado o borrado, y efectos reales adicionales si existen. |
| Catálogo/inventario | Altas, modificaciones y bajas reales de productos, insumos, recetas, ingredientes y relaciones. |
| Usuarios/permisos | Empleados, roles y relaciones reales que usa la autenticación local; cambios de acceso habilitado. |
| Otras mutaciones | Proveedores/turnos/etc. si forman parte del conjunto copiado y consultado offline. |

No inventar consumo de insumos donde el servicio actual no lo realiza. No mover consumo/reserva/venta de una etapa a otra para hacer coincidir un esquema teórico: conservar las pruebas y semántica del dominio.

Consolidar cambios repetidos de la misma fila en una operación o conservar una secuencia interna válida. Ejemplo: dos ítems del mismo producto no deben generar dos “postimágenes finales” incompatibles con las precondiciones. Mantener la preimagen inicial y el resultado final realmente confirmado.

El `actorId` sale del usuario autenticado, no de la constante `'cajero_principal'`. La identidad de operación proviene de una clave estable del intento, distinta del ID del pedido y de la hora del servidor.

### 4.3 Reparar el ejecutor antes de conectarlo

En `mutationExecutor.js`:

1. Inyectar conexiones explícitas `cloudDb`/`mirrorDb` cuando corresponda. Seleccionar una vez el destino al admitir la operación; no releer un modo global en mitad de la transacción.
2. Exigir identidad estable para mutaciones híbridas. Conservar el contrato de `Idempotency-Key` de crear pedido y ampliar las demás rutas; no fabricar una clave nueva en cada retry.
3. Guardar intención local `origin=online_intent`, request/hash y estado `prepared` antes de enviar el negocio cloud. La tabla actual tiene `origin` pero el código de escritura solo usa offline: implementar de verdad el camino online.
4. En una transacción cloud, comprobar fencing, deduplicar, ejecutar negocio, capturar efectos y registrar `sync_operations/head_seq` juntos. Si falla el journal, debe revertir el negocio.
5. Esperar que `cloudDb.transaction(...)` resuelva: el callback terminado todavía no es COMMIT confirmado.
6. Tras confirmar, aplicar al espejo por el mismo camino ordenado del incremental. Nunca aplicar directamente secuencia N+1 saltándose N.
7. Persistir cursor, deduplicación local y cierre de intención en la misma transacción SQLite.
8. Actualizar el estado en memoria **después** del COMMIT local. El cursor público aplicado sale del valor durable, no del head remoto deseado.
9. Si cloud confirmó y el espejo falló, conservar la venta cloud, devolver su resultado confirmado cuando se conoce y marcar espejo no listo con motivo. No repetir la venta ni devolver un mensaje que invite a crear una nueva.
10. En un replay cloud existente, recuperar también `seq`, efectos/hash y resultado de la operación registrada. Hoy la rama temprana devuelve solo resultado, con `cloudSeq=0` y collector vacío; eso impediría reparar una copia fallida.
11. Si el COMMIT cloud es incierto, conservar intención, `operation_id` y diagnóstico; pausar nuevas escrituras riesgosas. No ejecutar ese intento en SQLite como reemplazo. Al volver, resolver/reintentar idempotentemente esa misma identidad contra el journal.
12. Cuando la feature está apagada, conservar la ruta anterior sin este trabajo extra.

Una intención online preparada tras un reinicio no se considera una venta offline aceptada: hay que resolver su resultado cloud. No mandarla ciegamente por el camino de efectos offline.

### 4.4 Un único consumidor cloud → local, en orden

Aprovechar `applyIncrementalJournal`, pero agregar una función coordinadora que:

- Tenga exclusión por principal y no se ejecute simultáneamente desde petición, health, worker y timer.
- Se active tras COMMIT online confirmado, al arrancar conectado, después de resolver una intención y durante recuperación.
- Pueda tener mantenimiento periódico de baja frecuencia para recuperar trabajo, sin una consulta cloud por navegador/request.
- Capture un head remoto objetivo H y drene por lotes hasta ese H; si llegan ventas nuevas, se programará otro ciclo. No perseguir un head móvil indefinidamente.
- Si requiere ponerse al día para entrar/salir de contingencia, cierre admisión de escrituras, drene las ya iniciadas y compruebe head final bajo esa barrera.
- Lea desde `last_cloud_seq_applied + 1`, valide contigüidad, generación, versión/hash y aplique operación completa junto al cursor en una transacción.
- Detecte head mayor con cero operaciones recuperables como gap/error, no “todo aplicado”.
- No ignore excepciones: si falta alguna operación o aplicación, `localReady=false`, con motivo y reintento controlado.

**Prueba obligatoria:** con 120 operaciones nuevas y `batchLimit=50` tiene que aplicar 50+50+20 antes de declarar listo, no solo las primeras 50.

No combinar a la vez aplicación rápida fuera de orden y worker incremental independiente. La optimización de aplicar efectos recién recibidos sin releerlos es válida solo si pasa por la misma cola y verifica que su secuencia es exactamente la siguiente.

### 4.5 Cómo saber que la copia está lista

Separar funciones que hoy se confunden:

- Existe el archivo.
- Puede abrirse el archivo.
- Su esquema/bootstrap/integridad son válidos.
- Sus operaciones confirmadas están aplicadas hasta la última secuencia segura.
- No hay intención incierta ni un fallo de espejo sin reparar.

Solo la conjunción de las últimas garantías habilita contingencia. El archivo puede existir aunque esté vacío, viejo o corrupto.

Reemplazar el `catch => ready:true` por fallo explícito y registro sin datos sensibles. Derivar contadores/cursor/estado de SQLite al arrancar. No resetear accidentalmente contadores o cursor con defaults de `setLocalMirrorState` cuando solo se quiere cambiar una propiedad.

Al comenzar una nueva mutación online híbrida, invalidar temporalmente la readiness mientras su intención/confirmación no esté resuelta; no dejar una ventana en la que el origen ya cambió pero el sistema aún promete que puede conmutar.

El corte de red debe drenar/clasificar operaciones en vuelo antes de elegir SQLite. Si ya está todo aplicado y no hubo escritores externos, una copia sin tráfico reciente sigue siendo válida; la garantía depende del orden real, no de que el último sync tenga menos de X segundos.

### 4.6 Endurecer aplicación y deduplicación sin perder rendimiento

En `operationJournalService.js` y el consumidor:

- Validar operación, tabla, columnas, IDs, versión y hash; mantener allowlist y no aceptar SQL o parches arbitrarios del frontend.
- INSERT sobre fila existente: aceptar solo un replay demostrado mediante identidad/hash y estado esperado. Si la misma PK tiene datos distintos, conflicto; no ignorar ni reemplazar.
- UPDATE: verificar precondición y cardinalidad. Si falta la fila requerida, abortar operación y conservar cursor anterior; no avanzar con cero filas afectadas.
- DELETE: distinguir replay confirmado de ausencia inesperada. Mantener efectos/tombstones y relaciones/cascadas.
- Aplicar datos en orden de dependencias, sin apagar foreign keys.
- Para eficiencia, agrupar lecturas de las filas afectadas cuando sea posible; no comparar toda la tabla por cada UPDATE.

La idempotencia se demuestra por `operation_id + request_hash + effects_hash` y registro de aplicación, no por “la fila con ese ID existe”.

### 4.7 Mantener correcto el sentido offline → online mientras se corrige el otro

Revisar `recoveryWorker.js` antes de mezclarlo con el nuevo consumidor:

1. Las operaciones ya aplicadas localmente offline no deben aplicarse otra vez al recibir su journal cloud. Reconocer su identidad/hash, persistir ack y avanzar metadata en orden.
2. Si existen operaciones cloud intermedias desconocidas, no saltarlas escribiendo `last_cloud_seq_applied = cloudSeq` solo porque se confirmó una fila de outbox. Detectar divergencia y bloquear.
3. El head esperado tras una sincronización parcial avanza con los COMMIT propios reconocidos; no volver a compararlo con el head original de inicio de sesión.
4. Deduplicar antes de exigir head esperado para reconocer el ack perdido de una operación propia.
5. Capturar venta/merma/caja además del pedido. Los efectos nuevos deben ser completos: no usar fallbacks que reconstruyen desde el **estado final actual** de un pedido para adivinar efectos de una operación vieja.
6. Preservar pendientes legados/incompletos para revisión; no reinterpretarlos como si cumplieran el contrato nuevo. Agregar versión de captura si hace falta mediante migración aditiva.
7. Quitar `catch {}` del incremental al final del recovery. Fallo o lote incompleto impide `ready=true`, cierre de sesión offline y mensaje de éxito.
8. El worker no puede dar por aplicada una operación cuyo efecto no se ejecutó. Revisar los fallbacks `replicarPedidoDesdeLocal` y de cambio de estado: no omitir errores de stock/filas faltantes.
9. El token del cajero puede vencer luego de aceptar una venta offline; replay interno autentica al escritor y respeta la aceptación original. Eso no autoriza ventas nuevas con token vencido.

---

## 5. Cobertura: no arreglar solo el botón “crear pedido”

Construir una matriz pequeña antes de editar, con **todas las mutaciones de las tablas que se espejan**:

```text
ruta/método → servicio → transacción → filas afectadas
→ captura de efectos → journal online / outbox offline
→ prueba de equivalencia entre bases
```

Priorizar crear pedido, estados, completar/entregar, cancelar/quitar ítem y caja. Luego integrar catálogo/inventario/recetas/roles/empleados/proveedores/turnos que puedan cambiar mientras está online. Aunque una función esté bloqueada offline, **sus cambios online deben llegar al espejo** si una venta o el login local los necesita.

No existe una garantía general mientras haya una ruta que modifique tablas espejadas saltándose el protocolo. Durante el despliegue de la integración mantener la feature deshabilitada o declarar no lista la copia, no habilitarla a medias sin avisar.

### Equipos adicionales

Identificar si cada Electron abre su propio backend hacia Turso. El commit nuevo agrega instancia única **por equipo**, pero eso no prueba que haya un solo escritor en todo el comercio.

Para el alcance del plan existente, mantener un backend principal coordinador y secundarios que lo usen por LAN. No esconder el problema de otra instalación con un timer más frecuente: un escritor externo no integrado puede modificar cloud sin dejar journal y volver a romper el espejo.

Si el despliegue exige varios escritores independientes, no anunciar garantía de contingencia con este protocolo hasta diseñar y probar ese caso. Un chequeo de writer/generation que los otros programas no ejecutan no impide que escriban con sus credenciales.

Unificar la identidad que hoy tiene defaults diferentes (`caja_principal` y `wr_caja_principal`) y la generación; cargarla de configuración durable/estado registrado, no hardcodear `generation=1` en cada recuperación.

---

## 6. Puesta al día de las bases que ya están atrasadas

**Este paso es necesario:** activar el journal nuevo solo registra cambios futuros. No recupera ventas anteriores que nunca entraron en `sync_operations`. Incluso `head cloud == cursor local == 0` puede coexistir con bases distintas, como en la reproducción A.

Procedimiento controlado:

1. Hacer backups consistentes de Turso y SQLite/outbox; no copiar solo `.db` abierto ignorando WAL. No borrar bases “para probar”.
2. Hacer inventario de outbox por origen, estado y versión, incluyendo `conflict`, `prepared`, `sending` e `uncertain`. El arranque actual solo mira algunos estados y podría reemplazar datos que todavía requieren resolución.
3. Si hay ventas locales legítimas sin sincronizar o pedidos fantasmas, reconciliarlos explícitamente por identidad y evidencia. No tomar toda SQLite como verdad ni descartarla completa.
4. Una vez resueltos los pendientes y detenidos todos los escritores, activar la versión que registra **todas** las mutaciones cloud y ejecutar un bootstrap controlado.
5. Preservar el mecanismo temporal del bootstrap, pero verificar cierre/checkpoint, publicación y restauración de backup en Windows. No ignorar errores al renombrar el archivo previo y continuar como si la sustitución fuera segura.
6. Asegurar snapshot consistente: la comparación de `head_seq` antes/después solo detecta escrituras que sí usan journal. Pausar también cualquier escritor externo durante esa operación.
7. Verificar valores/relaciones y conteos, integridad/FK y cursor/generación. Un conteo igual no demuestra mismos valores de stock.
8. Publicar la copia validada, reanudar e iniciar incremental. En operación normal usar incremental, no repetir bootstrap completo en cada arranque.
9. Primera caída de prueba solo después de comprobar que una venta posterior al bootstrap ya llegó íntegra al espejo sin reiniciar la aplicación.

No ejecutar automáticamente un bootstrap encima de una outbox pendiente. No migrar ni borrar operaciones incompletas silenciosamente. El apagado de la feature o rollback de código también debe conservar su recuperación.

---

## 7. Secuencia exacta recomendada para implementar

Cada paso debe terminar con diff revisado y prueba que lo demuestre. No dejar el sistema parcialmente habilitado para uso real entre pasos.

### Paso 1 — Hacer ejecutables las pruebas y fijar la reproducción

- Incorporar correctamente el helper `tests/helpers/setupEnv.js` que referencia el package o corregir el contrato de setup, con configuración segura explícita. No inventar secretos de producción ni alterar tests para esconder el problema.
- Hacer independiente la configuración de tests de zona horaria de la máquina, sin cambiar fechas del negocio para que pase el test.
- Agregar un test con los servicios reales para la tabla de 1.3 y otro para el rollback de 1.4. Deben fallar con el código actual.
- Agregar factories/inyección de conexiones/estado para probar híbrido sin una cuenta Turso real. No basta con setear `NODE_ENV=test`, porque el routing real está condicionado a `environment !== 'test'`.

**Puerta:** reproducción roja de ambos bugs y suite oficial ejecutable.

### Paso 2 — Integrar ejecutor y captura de una operación vertical

- Corregir el ejecutor con conexiones explícitas, identidad, intención y journal transaccional.
- Separar cuerpo transaccional de `pedidoService.crear` para que no abra una transacción nueva anidada.
- Capturar cabecera, detalles y stock. Retirar la autoejecutable de réplica de líneas 226–260.
- Aplicar al espejo solo post-COMMIT, en orden y con cursor durable. Sincronización inmediata esperada al finalizar una operación segura, no “quizás después del próximo restart”.

**Puerta:** crear un pedido actualiza ambas bases y el journal; rollback no crea una copia local fantasma; ack perdido no duplica.

### Paso 3 — Completar el mapa de mutaciones

- Integrar estados/entrega/completar y registro de ventas.
- Integrar cancelaciones/quitar ítems/caja y sus efectos completos.
- Integrar mutaciones online administrativas de las tablas espejadas.
- Sustituir hooks duplicados y retirar capturas silenciosas de errores de outbox. Si outbox falla dentro de venta offline, debe revertirse toda esa venta.

**Puerta:** cada fila de la matriz de sección 5 tiene prueba de equivalencia y no existe un camino paralelo no registrado.

### Paso 4 — Drenaje incremental y readiness

- Un consumidor con exclusión, triggers definidos, target head y varios lotes.
- Validaciones de efectos y generación; no saltos de cursor ni defaults que lo reseteen.
- Publicar readiness después de COMMIT local y prohibir éxito cuando el consumidor falla.

**Puerta:** backlog de más de 50, fallo intermedio y reintento/reinicio se resuelven sin omisiones/duplicados.

### Paso 5 — Recovery y monitor único

- Integrar drenaje cloud→local con replay offline sin reaplicar negocio local.
- Eliminar decisiones de sync/transición de `GET /health`; moverlas al coordinador único.
- Exponer estado barato coherente, incluyendo pendiente del espejo e inciertos; interfaz muestra ese estado, no solo red disponible.

**Puerta:** reconectar no anuncia éxito hasta outbox/intentions/cursor consistentes; más clientes no crean más pruebas remotas.

### Paso 6 — Reparación y validación final

- Ejecutar procedimiento de sección 6 en entorno de prueba.
- Comparar carga online y comportamiento de la feature apagada.
- Ensayar WAN/LAN, restart y binario Windows.
- Actualizar documentación y registrar exactamente resultados/limitaciones.

**Puerta:** todos los tests relevantes y escenarios manuales pasan para el commit final. No prometer “perfecto” ni cero fallos de proveedor; declarar la garantía comprobada y sus condiciones.

---

## 8. Pruebas de aceptación específicas del problema actual

### 8.1 Tests automatizados que faltan

Nombres de archivos propuestos, no scripts ya existentes: `onlineMirror.test.js`, `hybridMutationIntegration.test.js`, `mirrorRecovery.test.js` o equivalentes coherentes con el repositorio.

| ID | Estímulo | Resultado que debe comprobar el test |
|---|---|---|
| T01 | Crear online dos unidades con stock inicial 10. | Origen/espejo stock 8; misma cabecera, detalles, IDs y claves; una operación cloud, cursor local aplicado. |
| T02 | Entregar el pedido online. | Ambos entregados y con una única venta equivalente; mismo costo/total/fecha/ID de venta. |
| T03 | Cambiar estado, completar y entregar por sus rutas reales. | Todos los efectos reales llegan; no solo `pedidos.estado`. Repetir no duplica venta. |
| T04 | Error al final del callback antes del COMMIT origen. | Origen revierte; espejo no incorpora ese intento; journal no lo confirma. |
| T05 | COMMIT cloud confirmado, aplicación local falla. | Venta existe una vez en cloud, readiness falsa, intención pendiente; catch-up la aplica una vez sin reenviar negocio. |
| T06 | Se pierde respuesta tras COMMIT cloud y se reintenta con la misma clave. | Recupera resultado/seq/efectos; una venta/descuento y espejo reparado. Clave con otro payload da conflicto. |
| T07 | Error al registrar journal cloud. | Revierte negocio cloud y no aplica espejo. |
| T08 | Error al escribir outbox de venta offline. | Revierte pedido, detalles y stock; no devuelve éxito local. |
| T09 | Cancelar/quitar ítem online y luego cortar Internet. | Total/estado, ítems, devolución o merma exactamente iguales en ambas bases. |
| T10 | Alta/baja de caja online. | Movimiento equivalente en espejo; replay de cada mutación no duplica ni borra otra cosa. |
| T11 | Editar precio/stock/receta/permisos online y vender/loguearse offline. | Datos actualizados del espejo; sin necesitar reiniciar. Si no terminó espejo, no habilitar offline. |
| T12 | Dos mutaciones cloud confirmadas casi juntas; se demora aplicación de la primera. | Cola respeta N antes de N+1; cursor nunca salta, retrocede ni confirma un hueco. |
| T13 | 120 operaciones nuevas, límite de lote 50. | Drena 50+50+20 hasta el target; no anuncia ready al lote 1. |
| T14 | Hay head remoto nuevo, pero falta operación en el rango. | Gap detectado y readiness falsa; no considerar éxito porque llegó cero filas. |
| T15 | UPDATE de fila inexistente o INSERT con misma PK y contenido distinto. | Conflicto/repair explícito; rollback de efectos y cursor sin avance falso. |
| T16 | Hash de efectos, versión o generación incorrectos. | Rechazo antes de aplicar; no saltar operación ni limpiar pendientes. |
| T17 | Reinicio tras cloud COMMIT antes de copiar; otro tras copia antes de responder. | Resolución por identidad y cursor durable, sin pérdidas ni duplicados. |
| T18 | Caída inmediata al terminar venta online. | Si ya se confirmó espejo, offline ve todo; si no, bloquea hasta resolver. Nunca opera con stock anterior. |
| T19 | Replay de ventas offline y luego consumo de su journal cloud. | No aplicar sus descuentos otra vez en SQLite. Venta/merma/caja quedan equivalentes. |
| T20 | Falla incremental al final de recovery o queda backlog. | No `ONLINE`, no ready ni mensaje de sincronización completada. |
| T21 | Solo existe archivo local vacío/corrupto o bootstrap incompleto. | No ready; error diagnosticable, sin excepción que lo vuelva true. |
| T22 | Base previa sin journal, cursor/head cero pero valores distintos. | Rebootstrap controlado necesario; no deducir igualdad por metadata. |
| T23 | Outbox con `conflict`, `prepared`, `sending` o venta legítima pendiente. | El arranque no reemplaza esa SQLite automáticamente. |
| T24 | Feature apagada, modo cloud/local independiente. | Sin carga nueva de réplica ni cambio de comportamiento anterior. |
| T25 | Varios clientes sondean estado, timer y sync manual simultáneos. | Un coordinador/consumidor; health no hace una ronda cloud por cliente. |
| T26 | Usuario no cajero/equipo secundario intenta forzar contingencia. | Rechazo por backend; ninguna escritura independiente o destino elegido por body/header. |
| T27 | Turso falla pero Internet sigue disponible. | Error cloud, no venta local de reemplazo. |
| T28 | Corte WAN, LAN activa y navegador aún `onLine=true`. | Decide backend; cajero usa solo espejo ya validado y los demás quedan bloqueados. |
| T29 | Dos retiros o dos pedidos compiten por el mismo recurso. | Conserva validaciones/saldo/stock existentes; el refactor no introduce doble efecto ni stock negativo. |
| T30 | Reinicio/cierre del monitor y apagado durante copia. | Una sola instancia, conexiones cerradas o trabajo recuperable, sin timers repetidos. |

Usar base origen y base espejo distintas. Verificar que el test falla si se elimina el journal o se omite un efecto. No mockear todo el ejecutor y luego declarar probada la integración.

### 8.2 Qué comparar, además del status HTTP

Para cada fixture comparar filas y valores normalizados de las tablas afectadas, FK/integridad, journal, outbox, hashes y cursores. Los precios/costos/fechas/IDs se conservan: no recalcularlos al sync. Mantener el orden de negocio actual de producto/insumo/venta.

Probar persistencia con archivos temporales y reapertura/proceso nuevo. `:memory:` por sí solo no prueba supervivencia a un cierre.

Dos SQLite prueban el protocolo de aplicación. Agregar después una base Turso **de prueba** para verificar transacciones HTTP, COMMIT incierto, dialecto y transporte reales. No ensayar fallos contra producción.

### 8.3 Comandos y limitación actual

Una vez versionado/reparado el setup:

```bash
npm ci --prefix backend
npm test --prefix backend
npm test --prefix backend -- --runTestsByPath tests/onlineMirror.test.js tests/hybridMutationIntegration.test.js tests/mirrorRecovery.test.js
npm run build --prefix frontend
npm run lint --prefix frontend
```

La tercera línea solo existe cuando se creen esos archivos; adaptar nombres a los realmente implementados. El frontend no tiene runner de tests declarado: si se agregan pruebas automatizadas UI, instalar/configurar el mínimo compatible y documentar sus comandos reales.

Para reproducir exclusivamente el diagnóstico alternativo realizado, desde `backend`, en un shell POSIX:

```bash
TZ=America/Argentina/Buenos_Aires NODE_ENV=test CONTINGENCY_ENABLED=false \
  node node_modules/jest/bin/jest.js --runInBand \
  --config '{"testEnvironment":"node","roots":["<rootDir>/tests"]}'
```

Ese bypass de configuración se usó solo para la auditoría. **No es la corrección final:** versionar el setup que falta, no acostumbrarse a ignorar la configuración del proyecto. Tampoco significa que se haya probado `CONTINGENCY_ENABLED=true` y routing real con esas 448 pruebas.

### 8.4 Ensayo manual que demuestra el arreglo para tu caso

En entorno de prueba y una misma sesión de aplicación, sin reiniciar para refrescar:

1. Arrancar conectado, preparar copia y comprobar readiness/cursor.
2. Crear producto o cambiar su precio/stock; crear pedido online y entregarlo; registrar movimiento de caja.
3. Verificar enseguida espejo: stock, precio, pedido entregado, venta y caja, no solo cabecera.
4. Cortar WAN manteniendo router/LAN. No usar solo “Offline” de DevTools: eso puede no cortar Internet de Node/Electron main.
5. Cajero ve los mismos datos; usuario normal queda bloqueado. Si había operación incierta, aparece bloqueo honesto, no datos anteriores.
6. Crear otra venta offline, cerrar/reabrir el principal todavía sin WAN y comprobar persistencia/outbox.
7. Reconectar, interrumpir una vez durante sync y reanudar.
8. Comparar ambas bases: cada pedido, venta, stock, merma y movimiento una sola vez; sin pendientes/inciertos ni huecos. Solo entonces mostrar normalidad.
9. Repetir en el instalador Windows, no solo Node de desarrollo. Verificar ruta `userData` y acceso de secundarios por HTTPS/LAN cuando WebCrypto lo requiera.

---

## 9. Rendimiento: mantener lo que mejoró

- Conservar consultas agrupadas, índices y pool actuales.
- Evitar una sonda cloud o barrido de tablas por cada venta/health/navegador.
- Registrar una operación y sus filas afectadas, no snapshots completos periódicos para parchear la integración ausente.
- Usar un consumidor y lotes acotados con backoff; no intervalos superpuestos.
- Medir antes/después las rutas de crear/entregar/cancelar/caja y apertura de pantallas con el mismo dataset/clientes.
- Registrar cantidad de consultas, p50/p95 de latencia y tamaño del backlog; definir el presupuesto aceptable sobre esa línea base, no inventar que el protocolo durable no agrega costo.
- Con feature apagada, verificar ausencia del nuevo trabajo de réplica.

La intención local, journal y copia agregan trabajo necesario. El objetivo es costo acotado y recuperable, sin volver a saturar Turso; no una promesa de cero consultas extra o cero errores posibles del proveedor.

---

## 10. Checklist de entrega para la IA implementadora

- [ ] Corregí el código actual; no restauré el fallback destructivo antiguo ni reescribí la aplicación.
- [ ] Todos los servicios reales necesarios invocan la frontera transaccional; no quedó el ejecutor sin callers.
- [ ] No hay IIFE/promesa de copia sin esperar ni réplica pre-COMMIT.
- [ ] Venta cloud y journal/head se confirman juntos; venta offline y outbox también.
- [ ] Se replican stock, estado, ventas, merma/caja y datos administrativos necesarios, no solo pedidos.
- [ ] Intenciones/replays reparan espejo tras error sin ejecutar de nuevo el negocio.
- [ ] Un consumidor mantiene orden y drena todos los lotes necesarios.
- [ ] Cursor publicado coincide con el aplicado durable, sin saltos ni reinicios a cero.
- [ ] Readiness no equivale a existencia de archivo y nunca se vuelve true por excepción.
- [ ] Error de espejo no se convierte en “sincronizado” ni en una segunda venta.
- [ ] Offline→online sigue íntegro y no vuelve a aplicar sus propios efectos locales.
- [ ] Bases previas sin journal se reparan por procedimiento controlado, conservando pendientes.
- [ ] Writer/generation coherentes y sin otra instalación que escriba por fuera del protocolo.
- [ ] `npm test` oficial arranca; pruebas nuevas cubren híbrido real y las reproducciones A/B.
- [ ] Tests, build/lint y medición de rendimiento están reportados con resultados reales y pendientes.
- [ ] Ensayo de WAN/LAN, restart, recovery y Windows documentado sin datos privados.

**Entrega final exigida:** archivos cambiados, migraciones nuevas si las hay, explicación breve del flujo definitivo, pruebas con resultados, evidencia manual segura y limitaciones conocidas. No aceptar “ya sincroniza” porque aparecen los pedidos: exigir equivalencia de todos sus efectos y recuperación tras fallos.

---

## 11. Resumen corto para usar como instrucción a otra IA

> Trabajá sobre los últimos commits, no sobre el diagnóstico viejo. Conservá el dialecto libSQL, las consultas agrupadas, los índices y la lógica de negocio. El problema principal es que `runBusinessMutation` no tiene callers reales y el hook online de `pedidoService` copia solo cabecera/detalles, antes del COMMIT y sin control de errores. Integrá un único ejecutor transaccional con captura completa/journal, intención durable y copia local post-COMMIT en orden. Mantené el espejo online con incremental y readiness verificada; no lo resuelvas copiando toda la base cada pocos segundos. Corregí los falsos éxitos de recovery, la falta de efectos de venta/caja y el setup de tests ausente. Implementá por las seis etapas de este documento y demostrá los casos T01–T30, en especial stock/venta online→local y rollback sin pedido fantasma. No borres datos ni pendientes existentes ni anuncies garantía total mientras haya escritores externos no integrados.
