const express = require('express');
const { dialog } = require('electron');
const { signMessage } = require('./crypto');
const { loadConfig } = require('./config');

/**
 * Start Express server for OAuth endpoint
 * Returns the server instance for cleanup
 */
function startServer(keypair) {
  const app = express();
  const PORT = 5000;

  // Middleware
  app.use(express.json());

  // CORS headers for local development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Handle preflight requests
  app.options('*', (req, res) => {
    res.sendStatus(200);
  });

  /**
   * POST /oauth - OAuth endpoint
   * Receives request with nonce, shows system dialog, returns signed response
   */
  app.post('/oauth', async (req, res) => {
    try {
      const { nonce } = req.body;

      console.log('[Server] Received OAuth request with nonce:', nonce);

      // Load saved config to use as defaults
      const savedConfig = loadConfig();
      const defaultName = savedConfig?.name || '';
      const defaultEmail = savedConfig?.email || '';

      console.log('[Server] Loaded saved config - Name:', defaultName || '(none)', 'Email:', defaultEmail || '(none)');

      // Show input dialogs with saved values as defaults
      let name, email;

      try {
        // Show input dialog for name with default value
        name = await showInputDialog('Enter your name:', 'Name', defaultName);

        if (!name) {
          console.log('[Server] User cancelled or provided empty name');
          return res.status(400).json({
            error: 'Name is required',
          });
        }

        // Show input dialog for email with default value
        email = await showInputDialog('Enter your email:', 'Email', defaultEmail);

        if (!email) {
          console.log('[Server] User cancelled or provided empty email');
          return res.status(400).json({
            error: 'Email is required',
          });
        }

        // Validate email format (basic)
        if (!email.includes('@')) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }
      } catch (dialogError) {
        console.error('[Server] Dialog error:', dialogError);
        return res.status(500).json({
          error: 'System dialog error',
        });
      }

      console.log('[Server] User provided - Name:', name, 'Email:', email);

      // Create message to sign
      const timestamp = new Date().toISOString();
      const message = {
        name,
        email,
        timestamp,
        nonce,
      };

      console.log('[Server] Signing message with ED25519...');

      // Sign the message
      const signature = await signMessage(message, keypair.privateKey);

      // Return signed response
      const response = {
        name,
        email,
        publicKey: keypair.publicKeyBase64,
        timestamp,
        signature,
        nonce,
      };

      console.log('[Server] OAuth request completed successfully');
      res.json(response);
    } catch (error) {
      console.error('[Server] Error processing OAuth request:', error);
      res.status(500).json({
        error: 'Internal server error: ' + error.message,
      });
    }
  });

  /**
   * GET /health - Health check endpoint
   */
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Local OAuth Agent' });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`[Server] ✅ Local OAuth Agent running on http://localhost:${PORT}`);
    console.log(`[Server] Ready to receive OAuth requests from http://localhost:3000`);
  });

  return server;
}

/**
 * Simple input dialog workaround for Electron
 * In production, you might want to create a BrowserWindow with React form
 * For MVP, we'll use a simple message box approach
 * @param {string} message - Message to display
 * @param {string} field - Field name (Name/Email)
 * @param {string} defaultValue - Default value to pre-fill
 */
async function showInputDialog(message, field, defaultValue = '') {
  // For MVP, we'll create a simple BrowserWindow with an HTML form
  const { BrowserWindow, ipcMain } = require('electron');
  const path = require('path');

  return new Promise((resolve) => {
    const preloadPath = path.join(__dirname, 'input-preload.js');
    
    // Get the main window to use as parent for modal
    const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    
    // Create unique channel for this dialog instance
    const channelId = `input-result-${Date.now()}-${Math.random()}`;
    
    const inputWindow = new BrowserWindow({
      width: 400,
      height: 250,
      modal: true,
      parent: mainWindow || undefined,
      show: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Store channel ID in window for cleanup
    inputWindow.channelId = channelId;

    // Load HTML file
    const htmlPath = path.join(__dirname, 'input-dialog.html');
    inputWindow.loadFile(htmlPath);

    // Send data to the dialog after it loads
    inputWindow.webContents.once('did-finish-load', () => {
      inputWindow.webContents.send('input-dialog-data', {
        message: message,
        placeholder: `Enter ${field.toLowerCase()}`,
        defaultValue: defaultValue || '',
        channelId: channelId,
      });
    });

    let completed = false;

    inputWindow.once('ready-to-show', () => {
      inputWindow.show();
      console.log('[Server] Input dialog displayed for:', field);
    });

    inputWindow.on('closed', () => {
      if (!completed) {
        // Remove IPC listener if window closed without submitting
        ipcMain.removeAllListeners(channelId);
        resolve(null);
      }
    });

    // Listen for IPC message from preload using unique channel
    const handler = (event, value) => {
      // Only handle if this is for our window
      if (event.sender === inputWindow.webContents) {
        completed = true;
        ipcMain.removeListener(channelId, handler);
        inputWindow.destroy();
        resolve(value);
      }
    };
    
    ipcMain.on(channelId, handler);

    // Fallback: close window after 5 minutes
    setTimeout(() => {
      if (!completed && inputWindow && !inputWindow.isDestroyed()) {
        ipcMain.removeListener(channelId, handler);
        resolve(null);
        inputWindow.destroy();
      }
    }, 5 * 60 * 1000);
  });
}

module.exports = startServer;
