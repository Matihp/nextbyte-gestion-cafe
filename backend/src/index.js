const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const checkConnection = require('./middlewares/checkConnection');
const checkRoleOffline = require('./middlewares/checkRole');

const app = express();

// Middlewares globales de seguridad y parseo
app.use(cors());  // Permite la comunicación con el frontend
app.use(express.json()); // Parsea JSON en el body
app.use(express.urlencoded({ extended: true })); // Parsea datos de formularios
app.use(morgan('dev')); // Logger de peticiones HTTP

// Middlewares de Arquitectura Offline/Online
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

// --- MANEJO DE ERRORES GLOBALES ---

// Manejo de Rutas no encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Manejador Global de Errores (500)
app.use((err, req, res, next) => {
  console.error('[Error Global]:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Ocurrió un error interno en el servidor.',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
