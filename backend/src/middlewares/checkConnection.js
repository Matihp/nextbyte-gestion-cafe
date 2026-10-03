const { dbLocal } = require('../config/db');

/**
 * Middleware para verificar si hay conexión a internet activa
 */
const checkConnection = async (req, res, next) => {
  try {
    // 1. Verificar conexión a internet
    let isOnline = true;
    
    // 2. Si detecta internet, revisar que no hayan datos viejos sin subir
    if (isOnline) {
      // Para despues: consultar si hay registros pendientes en SQLite.
      // Dependerá de las tablas que incorporemos
      const hasPendingData = false;
      
      // Si todavía hay datos pendientes de subir, forzamos a que el sistema actúe 
      // como si estuviera offline hasta que esto nuevo se guarde detrás de los viejos.
      if (hasPendingData) {
        isOnline = false;
        console.log('⏳ [Info] Internet detectado, pero hay datos locales pendientes. Enrutando a local temporalmente.');
      }
    }
    req.isOnline = isOnline;
    next();
  } catch (error) {
    console.error("❌ Error al verificar conexión/sincronización:", error);
    req.isOnline = false; 
    next();
  }
};

module.exports = checkConnection;
