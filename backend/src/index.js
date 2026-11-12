const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('./app');
const { initializeDatabase, getActiveDb } = require('./config/db');
const { detenerSyncJob, iniciarSyncJob } = require('./jobs/syncJob');

const start = async () => {
  const isContingencyEnabled = process.env.CONTINGENCY_ENABLED === 'true';
  let server;

  try {
    await initializeDatabase();
  } catch (error) {
    console.warn('Aviso al conectar base de datos principal:', error.message);
    try {
      const { setOnlineStatus } = require('./config/db');
      setOnlineStatus(false);
      const { getConnectivityService } = require('./services/connectivityService');
      getConnectivityService().reportCloudFailure(error);
    } catch {}
    if (!isContingencyEnabled && process.env.NODE_ENV === 'production') {
      throw error;
    }
  }

  if (isContingencyEnabled) {
    try {
      const { initContingencyOnBoot } = require('./config/contingencyDb');
      const { rawDb, databaseMode, isOnline } = require('./config/db');
      await initContingencyOnBoot({
        sourceDb: (databaseMode === 'cloud' && isOnline()) ? rawDb : null,
        writerId: process.env.WRITER_ID || 'wr_caja_principal'
      });
    } catch (err) {
      console.warn('Aviso al inicializar contingencia:', err.message);
    }
    iniciarSyncJob();
  }

  server = app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 3000}`);
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    detenerSyncJob();
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    if (server) {
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
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

start().catch(async (error) => {
  console.error('❌ No se inició el backend:', error.message);
  await getActiveDb().destroy();
  process.exitCode = 1;
});
