const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const checkConnection = require('./middlewares/checkConnection');
const checkRoleOffline = require('./middlewares/checkRole');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { databaseMode } = require('./config/db');
const { getConnectivityService } = require('./services/connectivityService');

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
app.get('/api/health', (req, res) => {
  const connectivity = getConnectivityService({ databaseMode });
  const state = connectivity.getState(req.user);

  res.json({
    message: 'Backend NextByte funcionando correctamente!',
    isOnline: Boolean(req.isOnline !== undefined ? req.isOnline : state.isOnline),
    databaseMode,
    mode: state.mode,
    localReady: state.localReady,
    pendingCount: state.pendingCount || 0,
    uncertainCount: state.uncertainCount || 0,
    lastCloudSeq: state.lastCloudSeq || 0,
    reason: state.reason || null,
    status: databaseMode === 'local'
      ? 'SQLite local (base principal)'
      : databaseMode === 'test'
        ? 'SQLite de prueba'
        : state.isOnline
          ? 'Online (Turso)'
          : 'Turso no disponible (sin fallback)'
  });
});

// Todos los módulos se registran en routes/index.js
app.use('/api', require('./routes'));

// Servir frontend compilado (Vite) en modo producción / Electron
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
