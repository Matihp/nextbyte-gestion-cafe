const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const checkConnection = require('./middlewares/checkConnection');
const checkRoleOffline = require('./middlewares/checkRole');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { databaseMode } = require('./config/db');

const app = express();

// Middlewares globales de seguridad y parseo
app.use(cors()); // Permite la comunicación con el frontend
app.use(express.json()); // Parsea JSON en el body
app.use(express.urlencoded({ extended: true })); // Parsea datos de formularios
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev')); // Logger de peticiones HTTP (se silencia en los tests)
}

// Middlewares de Arquitectura offline/online
app.use(checkConnection);
app.use('/api', checkRoleOffline);

// --- RUTAS ---

// Ruta de prueba base
const { getConnectivityService } = require('./services/connectivityService');

app.get('/api/health', async (req, res) => {
  const connectivity = getConnectivityService({ databaseMode });
  let state = connectivity.getState(req.user);

  // Si estamos en contingencia offline o sin conexión en Turso, intentar reconectar y sincronizar
  const modeUpper = String(state.mode || '').toUpperCase();
  if (databaseMode === 'cloud' && (modeUpper === 'OFFLINE_ACTIVE' || !req.isOnline || !state.isOnline)) {
    try {
      const { verificarConexionTurso, sincronizar } = require('./jobs/syncJob');
      const tursoOk = await verificarConexionTurso(2000);
      if (tursoOk) {
        if (state.syncEnabled && modeUpper === 'OFFLINE_ACTIVE') {
          await sincronizar().catch((e) => console.warn('Aviso al sincronizar en health:', e.message));
        } else {
          connectivity.mode = 'ONLINE';
          connectivity.reason = null;
          connectivity.reportCloudSuccess();
        }
        state = connectivity.getState(req.user);
        req.isOnline = true;
      }
    } catch {}
  }

  res.json({
    message: 'Backend NextByte funcionando correctamente!',
    isOnline: Boolean(req.isOnline !== undefined ? req.isOnline : state.isOnline),
    databaseMode,
    mode: state.mode,
    localReady: state.localReady,
    status: databaseMode === 'local' ? 'SQLite local (base principal)' : databaseMode === 'test' ? 'SQLite de prueba' : state.isOnline ? 'Online (Turso)' : 'Turso no disponible (sin fallback)'
  });
});

// Todos los módulos se registran en routes/index.js
app.use('/api', require('./routes'));

// Servir frontend compilado (Vite) en modo producción / Electron
const path = require('path');
const fs = require('fs');
const frontendDist = path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist) && process.env.NODE_ENV !== 'test') {
  app.use(express.static(frontendDist));
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// --- MANEJO DE ERRORES GLOBALES ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
