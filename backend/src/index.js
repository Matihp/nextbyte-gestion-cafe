const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('./app');
const { initializeDatabase, getActiveDb } = require('./config/db');

const start = async () => {
  await initializeDatabase();
  const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 3000}`);
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try {
        await getActiveDb().destroy();
        clearTimeout(timeout);
        process.exitCode = 0;
      } catch (error) {
        console.error('Error al cerrar la base:', error.message);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

start().catch(async (error) => {
  console.error('❌ No se inició el backend:', error.message);
  await getActiveDb().destroy();
  process.exitCode = 1;
});
