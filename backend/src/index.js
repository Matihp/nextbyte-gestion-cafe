require('dotenv').config();

const app = require('./app');
const { iniciarSyncJob } = require('./jobs/syncJob');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  iniciarSyncJob();
});
