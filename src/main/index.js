const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const startServer = require('./server');
const { loadOrCreateKeypair } = require('./crypto');
const { loadConfig, saveConfig } = require('./config');

let mainWindow;
let serverInstance;

app.on('ready', async () => {
  try {
    // Initialize keypair on startup
    console.log('[Local OAuth] Initializing ED25519 keypair...');
    const keypair = await loadOrCreateKeypair();
    console.log('[Local OAuth] Keypair initialized');
    console.log('[Local OAuth] Public Key:', keypair.publicKey);

    // Create main window with form
    mainWindow = new BrowserWindow({
      width: 450,
      height: 500,
      show: false, // Don't show until ready
      webPreferences: {
        preload: path.join(__dirname, 'input-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      console.log('[Local OAuth] Main window displayed');
    });

    // Handle page load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('[Local OAuth] Failed to load page:', errorCode, errorDescription);
    });

    // Load HTML page with form
    const htmlPath = path.join(__dirname, 'index.html');
    console.log('[Local OAuth] Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);

    // Start Express server
    console.log('[Local OAuth] Starting Express server on port 5000...');
    serverInstance = startServer(keypair);


    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  } catch (error) {
    console.error('[Local OAuth] Error during initialization:', error);
    process.exit(1);
  }
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('[Local OAuth] Server closed');
    });
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = new BrowserWindow();
  }
});

// IPC handlers for user info
ipcMain.handle('save-user-info', async (event, email, name) => {
  try {
    const config = saveConfig(email, name);
    console.log('[Main] User info saved:', { email, name });
    return config;
  } catch (error) {
    console.error('[Main] Error saving user info:', error);
    throw error;
  }
});

ipcMain.handle('load-user-info', async (event) => {
  try {
    const config = loadConfig();
    return config || { email: null, name: null };
  } catch (error) {
    console.error('[Main] Error loading user info:', error);
    return { email: null, name: null };
  }
});
