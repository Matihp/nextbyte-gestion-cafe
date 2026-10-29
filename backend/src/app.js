const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const checkConnection = require('./middlewares/checkConnection');
const checkRoleOffline = require('./middlewares/checkRole');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

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
app.use(checkRoleOffline);

// --- RUTAS ---

// Ruta de prueba base
app.get('/api/health', (req, res) => {
  res.json({
    message: 'Backend NextByte funcionando correctamente!',
    status: req.isOnline ? 'Online (Turso)' : 'Offline (SQLite Contingencia)'
  });
});

// Todos los módulos se registran en routes/index.js
app.use('/api', require('./routes'));

// --- MANEJO DE ERRORES GLOBALES ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
