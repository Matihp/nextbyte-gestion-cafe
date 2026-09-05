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

- **`routes/`**: aca solo van las urls (los endpoints).
- **`dtos/`**: para validar que el front nos mande bien los datos (q no falten campos).
- **`controllers/`**: reciben la peticion de la ruta, llaman al service y devuelven la respuesta. no pongan logica aca.
- **`services/`**: aca va la logica pesada de negocio (descontar stock, calcular totales, etc).
- **`repositories/`**: el unico lugar donde se usa knex para tocar la base de datos (hacer los select, insert, update).
- **`utils/`**: funciones sueltas q nos sirvan a todos (ej: formatear fechas).

---

## 3. estructura del frontend (react)
en el front vamos a separar por funcionalidades (features) para no editar todos la misma carpeta de componentes y que explote git.

la carpeta mas importante es **`src/features/`**. 
ahi adentro hay una subcarpeta para cada modulo (menu, pedidos, etc). el 95% de tu tiempo vas a trabajar adentro de tu propia carpeta.

ejemplo, si te toco inventario:
adentro de `features/inventario/` podes crearte tu propia carpeta de `components/` o `hooks/` q sean exclusivas de tu modulo. asi no molestas al resto.

las carpetas `components/`, `hooks/`, `utils/` que estan en la raiz (fuera de features) son **solo para cosas globales** que usamos todos, como un boton generico, el navbar o cosas asi.

---

## 4. reglas de oro (para no romper nada)
- **el archivo .env NO se sube a github**: cada uno tiene que crearse su propio archivo `.env` en el backend con su usuario y contraseña de su base de datos local.
- **actualicen su codigo**: cuando le aceptamos el pull request a un compañero en github, su codigo se une a la rama main. por eso, siempre hagan `git pull origin main` para bajarse esos cambios nuevos antes de seguir programando.
- **npm install**: si te bajaste cambios y el codigo de repente no te anda, acordate de correr `npm install` (quizas algun compañero instalo una libreria nueva).
- **no entren en panico con los conflictos**: si al hacer git pull o git push les sale un error gigante rojo o dice "conflict" / "rejected", no rompieron nada. solo significa que vos y un compañero tocaron la misma linea del mismo archivo. avisen en el grupo y lo resolvemos en 2 minutos con el editor.

