const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const Module = require('module');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

if (app.isPackaged) {
  const backendModules = path.join(process.resourcesPath, 'backend', 'node_modules');
  if (!Module.globalPaths.includes(backendModules)) {
    Module.globalPaths.push(backendModules);
  }
  process.env.NODE_PATH = (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + backendModules;
  Module._initPaths();
}

let mainWindow;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Función para esperar a que el backend Express esté listo en el puerto 3000
function esperarBackend(url, timeoutMs = 15000) {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const verificar = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(verificar, 300);
        }
      }).on('error', () => {
        if (Date.now() - inicio > timeoutMs) {
          reject(new Error('El backend no respondió a tiempo'));
        } else {
          setTimeout(verificar, 300);
        }
      });
    };
    verificar();
  });
}

async function crearVentana() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'NextByte Café',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  try {
    await esperarBackend('http://localhost:3000/api/health');
    mainWindow.loadURL('http://localhost:3000');
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialización de Electron
app.whenReady().then(() => {
  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!process.env.LOCAL_DB_PATH) {
      process.env.LOCAL_DB_PATH = path.join(dataDir, 'contingencia.db');
    }
    if (!process.env.APP_ROLE) {
      process.env.APP_ROLE = 'CAJA_PRINCIPAL';
    }
    require(path.join(__dirname, '../backend/src/index.js'));
  } catch (err) {
    console.error('Error al iniciar el proceso backend:', err);
  }

  crearVentana();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
