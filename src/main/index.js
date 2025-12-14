const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const startServer = require('./server');
const { loadOrCreateKeypair } = require('./crypto');

let mainWindow;
let serverInstance;

app.on('ready', async () => {
  try {
    // Initialize keypair on startup
    console.log('[Local OAuth] Initializing ED25519 keypair...');
    const keypair = await loadOrCreateKeypair();
    console.log('[Local OAuth] Keypair initialized');
    console.log('[Local OAuth] Public Key:', keypair.publicKey);

    // Create hidden window (or minimal window)
    mainWindow = new BrowserWindow({
      width: 400,
      height: 300,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load a simple HTML page or just keep it hidden
    mainWindow.loadURL(`data:text/html,<!DOCTYPE html>
    <html>
      <head>
        <title>Local OAuth Agent</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin: 0 0 10px 0;
          }
          p {
            color: #666;
            margin: 0;
            font-size: 14px;
          }
          .status {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Local OAuth Agent</h1>
          <p>Running on http://localhost:5000</p>
          <div class="status">Active</div>
        </div>
      </body>
    </html>`);

    // Start Express server
    console.log('[Local OAuth] Starting Express server on port 5000...');
    serverInstance = startServer(keypair);

    // Don't show window by default, but allow developer to open it
    if (process.argv.includes('--dev')) {
      mainWindow.show();
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
