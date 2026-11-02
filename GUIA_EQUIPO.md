# guia de trabajo para el equipo

chicos, les dejo anotado como vamos a organizar el codigo y como usar git asi no nos pisamos los archivos y evitamos conflictos.

## 1. como usar git (ramas)
regla nro 1: **nadie toca la rama main directo**.
cada uno va a trabajar en su propia rama segun el modulo que le toco.

para crear tu rama la primera vez y empezar a trabajar, escribis:
`git checkout -b feature/nombre-de-tu-modulo` (ej: feature/pedidos)

*(ojo: git se guarda tu rama aunque apagues la pc. pero si por algun error volves a main y queres entrar a tu rama ya creada, tenes que usar el mismo comando SIN la "-b", o sea: `git checkout feature/nombre-de-tu-modulo`)*

cuando terminas algo y queres subirlo:
1. `git add .`
2. `git commit -m "agregue x cosa al modulo y"`
3. `git push origin feature/nombre-de-tu-modulo`

despues de hacer el push, el codigo no va a main automaticamente:
1. entran a la pagina de github.
2. les va a aparecer un cartelito verde que dice "Compare & pull request". lo aprietan, le ponen un titulo o una descripcion y lo crean.
3. me avisan para que yo lo revise y lo acepte. nadie mas puede meter codigo a main directo.

---

## 2. estructura del backend (node + knex)
usamos arquitectura en capas. **por favor respeten esto y no creen una carpeta "models"**. usamos repositories.

- **`config/`**: aca esta armada la conexion a la base de datos lista para usar. **nadie tiene que modificar nada de esta carpeta**.
- **`routes/`**: aca solo van las urls (los endpoints).
- **`middlewares/`**: filtros antes de llegar al controller (ej: ver si hay internet, ver rol de la pc en caso de caida).
- **`dtos/`**: para validar que el front nos mande bien los datos (q no falten campos).
- **`controllers/`**: reciben la peticion de la ruta, llaman al service y devuelven la respuesta. no pongan logica aca.
- **`services/`**: aca va la logica pesada de negocio (descontar stock, calcular totales, etc).
- **`repositories/`**: el unico lugar donde se toca la base de datos. para usar knex aca, simplemente escriben `const { dbLocal } = require('../config/db');` arriba de su archivo y ya pueden hacer inserts/selects sin configurar nada mas.
- **`jobs/`**: aca van procesos q corren en segundo plano (ej: sincronizar los datos si se cortó el internet y volvió).
- **`utils/`**: funciones sueltas q nos sirvan a todos (ej: formatear fechas).

### 2.1. el viaje de un dato (como hacer un crud paso a paso)
para que no se mareen, cuando les toque crear un modulo nuevo (ej: guardar un producto), el orden de los archivos que van a usar es siempre este:

1. **la ruta (`routes/`)**: aca definen la url (ej: `app.post('/productos')`) y le dicen "che, cuando alguien entre aca, mandaselo al controller x".
2. **el controlador (`controllers/`)**: el controller atiende la peticion. su unico trabajo es agarrar lo que el front nos mandó (ej: `req.body.nombre`) y pasarselo al service. **importante:** aca no hagan cuentas ni validaciones locas.
3. **el servicio (`services/`)**: el cerebro del backend. aca llega el dato del controller. uds validan: "el precio es negativo? lanzo error". si todo esta joya, le dicen al repository: "toma, guardalo".
4. **el repositorio (`repositories/`)**: aca es el **unico** archivo donde pueden usar `knex`. agarra los datos limpios q le mando el service y hace el `insert into productos...`. dsp le avisa al service que ya termino. 
5. el service recibe el ok, se lo avisa al controller y el controller por fin le responde al front (`res.json({ success: true })`).

---

## 3. estructura del frontend (react + shadcn/ui)
en el front vamos a separar por funcionalidades (features) para no editar todos la misma carpeta de componentes y que explote git. usamos **React Router** para navegar y **Shadcn/UI** para el diseño premium.

**carpetas importantes:**
- **`src/features/`**: aca va el 95% de tu trabajo visual. hay una carpeta para cada modulo (inventario, pedidos, dashboard, etc). adentro de tu modulo te podes crear tus propias subcarpetas de componentes para no molestar a los demas.
- **`src/services/`**: **¡super importante!** aca viven las conexiones con el backend. ya les deje un archivo para cada modulo (`pedidoService.js`, `productoService.js`, `inventarioService.js`, `comandaService.js`, etc.) y el cliente central `api.js`. **no hagan `fetch()` ni axios manual en sus componentes**. importen su servicio y llamen a la funcion directamente (ej: `pedidoService.obtenerTodos()`). el cliente `api.js` ya le manda el token JWT solo al backend y si se vence la sesion te manda al login automaticamente.
- **`src/components/ui/`**: **¡super importante!** aca viven los componentes maestros de diseño (botones, inputs, tablas). *nadie usa `<button>` o `<input>` de html comun*. todos tienen que importar y usar los que estan en esta carpeta para que todo el sistema sea visualmente igual.
- **`src/hooks/`**: aca tenemos `useAuth.js`. si en tu pantalla necesitas saber quien esta usando el sistema o su rol, escribis `const { user, isAdmin } = useAuth();` y listo.
- **`src/utils/`**: funciones utilitarias que usamos todos. ya deje listo `formatters.js` para mostrar precios en pesos y fechas de forma estandar.
- **`src/layouts/`**: aca esta el `DashboardLayout.jsx`. es la "plantilla" maestra que tiene pegado el menu lateral fijo a la izquierda y el header con el usuario conectado y boton de salir.
- **`src/index.css`**: aca adentro, en la regla `:root`, ya deje configurada la **paleta oficial de colores** (marron chocolate, crema, terracota, etc). ¡NO pongan colores manuales en su codigo (nada de `bg-[#4B2B1D]`)! Solo usen las clases de Tailwind de toda la vida (como `bg-primary`, `bg-secondary`, `bg-background`) y el sistema automaticamente tomara los colores.

### 3.1. como agregar una pantalla nueva
si te toco hacer una pantalla (ej: inventario), los pasos para que aparezca son:
1. armala adentro de `src/features/inventario/Inventario.jsx` usando los componentes que quieras de Shadcn (por ej: `Card`, `Table`, `Input`).
2. vas a `src/App.jsx`.
3. agregas tu ruta adentro del bloque de rutas privadas (`<Route element={<DashboardLayout />}>`). 
4. anda a `src/layouts/DashboardLayout.jsx` y fijate si esta en el `menuItems`(al principio de todo) con su nombre y enlace correcto.

### 3.2. tips salvavidas para el frontend
- **NUNCA usen la etiqueta `<a href="...">`**: si quieren ir a otra pantalla, usen el componente `<Link to="...">` de `react-router-dom`. Si usan `<a>`, la pagina entera se recarga y tardara mas.
- **Peticiones al backend (usen los servicios, NO fetch ni axios manual)**: no hagan `fetch('/api/...')` ni configuren axios a mano en sus pantallas. simplemente importen el servicio que les toca desde `@/services/suServicio` y usen sus metodos (`await pedidoService.crear(datos)`). asi nadie pisa codigo ajeno y si mañana cambia una url se toca en un solo lugar.
- **Cartelitos y notificaciones (PROHIBIDO `alert()` o `confirm()`)**: no usen las ventanas emergentes feas del navegador. ya deje configurado **Sonner**. en cualquier componente importan `toast` y tiran alertas hermosas:
  ```jsx
  import { toast } from 'sonner';

  toast.success('Pedido creado correctamente');
  toast.error('Ocurrió un error al guardar');
  toast.info('Recordá cerrar la caja antes de salir');
  ```
- **Formatear precios y fechas (usen `formatters.js`)**: no inventen formas de mostrar precios ni fechas con concatenaciones de texto. importen las funciones maestras:
  ```jsx
  import { formatearPrecio, formatearFecha } from '@/utils/formatters';

  <p>{formatearPrecio(item.precio)}</p>     {/* Muestra: $ 1.500,00 */}
  <p>{formatearFecha(item.created_at)}</p>  {/* Muestra: 02/11/2026 15:30 */}
  ```
- **Evitar doble clic al guardar (estados de carga)**: cuando hagan un boton para guardar o enviar un formulario, deshabilitenlo mientras este cargando (`disabled={cargando}`) para que nadie le de 3 clics seguidos y mande 3 pedidos duplicados.
- **Como saber que usuario esta conectado**: si en tu vista queres mostrar "Hola, Juan" o esconder un boton si no es administrador, podes usar:
  ```jsx
  import { useAuth } from '@/hooks/useAuth';
  // adentro de tu componente:
  const { user, isAdmin } = useAuth();
  ```
- **¿Que es el `@/` en los imports?**: si ven un `import { Button } from "@/components/..."`, esa `@` significa "anda a la carpeta `src/`". es un atajo para no tener que escribir `../../../../components`.
- **Íconos**: Para poner un icono (una casita, un tacho de basura), **NO instalen FontAwesome ni librerías pesadas**. Ya tenemos instalada una oficial y gratuita llamada **Lucide React**. Vayan a `lucide.dev`, busquen el nombre, y lo importan así: `import { Trash2, Home } from "lucide-react";`.

---

## 4. reglas de oro (para no romper nada)
- **los archivos .env NO se suben a github**: 
  - en `backend/`: copien `.env.example`, renommbrenlo a `.env` y dejenlo ahi (ahi esta la config de la base SQLite `dev_local.db`).
  - en `frontend/`: copien `.env.example`, renommbrenlo a `.env` y dejenlo ahi (ahi esta la variable `VITE_API_URL=http://localhost:3000/api`).
- **NO instalen librerias de npm sin consultar**: antes de tirar un `npm install x-libreria`, hablen en el grupo. ya tenemos casi todo instalado (iconos con `lucide-react`, graficos con `recharts`, alertas con `sonner`, componentes con `shadcn`, peticiones con `axios`). instalar paquetes raros puede romper la compatibilidad con React 19 o Tailwind 4 para todos.
- **Manejen listas vacias (empty states)**: si van a mostrar una tabla de pedidos o productos y todavia no hay registros (`lista.length === 0`), muestren un mensajito amigable como "No hay pedidos registrados todavía" en vez de dejar la pantalla en blanco o que tire error.
- **pruebas en DBeaver/Datagrip (como conectarse)**: para ver sus tablas, abran DBeaver -> "Nueva Conexión" -> elijan "SQLite" -> en el campo "Ruta" busquen y seleccionen el archivo `dev_local.db` que esta en su carpeta `backend/` (si no lo ven, corran el proyecto una vez para que se cree). *(si es la primera vez, DBeaver les va a pedir descargar el driver de SQLite, denle a descargar)*. no usaremos una db online compartida por el momento.
- **actualicen su codigo**: cuando le aceptamos el pull request a un compañero en github, su codigo se une a la rama main. por eso, siempre hagan `git pull origin main` para bajarse esos cambios nuevos antes de seguir programando.
- **como arrancar el proyecto**: abran 2 terminales (una en la carpeta `backend/` y otra en `frontend/`). en ambas corran `npm install` (por si alguien agrego algo nuevo) y dsp escriban `npm run dev`. con eso levantan el servidor y la web al mismo tiempo.
- **no entren en panico con los conflictos**: si al hacer git pull o git push les sale un error gigante rojo o dice "conflict" / "rejected", no rompieron nada. solo significa que vos y un compañero tocaron la misma linea del mismo archivo. avisen en el grupo y lo resolvemos en 2 minutos con el editor.
