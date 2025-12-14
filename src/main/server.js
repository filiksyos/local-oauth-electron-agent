const express = require('express');
const { dialog } = require('electron');
const { signMessage } = require('./crypto');

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

      // Show native system dialog asking for name and email
      // We'll use a simple approach with two dialogs
      let name, email;

      try {
        // First dialog - Ask for name
        const nameResult = await dialog.showMessageBox({
          type: 'question',
          title: 'Local OAuth - Enter Your Name',
          message: 'Please enter your name:',
          detail: 'Your identity will be cryptographically signed and verified.',
          buttons: ['Cancel', 'Next'],
          defaultId: 1,
          cancelId: 0,
        });

        if (nameResult.response === 0) {
          // User clicked Cancel
          console.log('[Server] User cancelled OAuth - name input');
          return res.status(400).json({
            error: 'User cancelled identity verification',
          });
        }

        // Show input dialog for name (using a workaround since showMessageBox doesn't have input)
        // For now, we'll use the detail as context and prompt again
        const nameInputResult = await dialog.showMessageBox({
          type: 'info',
          title: 'Local OAuth - Identity Verification',
          message: 'Enter your name in the input field below:',
          detail: 'Your name will be stored securely in the signed verification.',
          buttons: ['Cancel', 'Continue'],
          defaultId: 1,
          cancelId: 0,
        });

        if (nameInputResult.response === 0) {
          return res.status(400).json({
            error: 'User cancelled identity verification',
          });
        }

        // Since Electron's dialog doesn't have input fields, we use a workaround
        // For MVP, we'll prompt via modal or use test data
        // In production, you might want to show a BrowserWindow with HTML form
        name = await showInputDialog('Enter your name:', 'Name');

        if (!name) {
          console.log('[Server] User cancelled or provided empty name');
          return res.status(400).json({
            error: 'Name is required',
          });
        }

        // Second dialog - Ask for email
        email = await showInputDialog('Enter your email:', 'Email');

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
 */
async function showInputDialog(message, field) {
  const { clipboard, dialog } = require('electron');

  // For MVP, we'll create a simple BrowserWindow with an HTML form
  const { BrowserWindow } = require('electron');

  return new Promise((resolve) => {
    const inputWindow = new BrowserWindow({
      width: 400,
      height: 200,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    inputWindow.loadURL(`data:text/html,<!DOCTYPE html>
    <html>
      <head>
        <title>Local OAuth - ${field}</title>
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
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 320px;
          }
          h2 {
            color: #333;
            margin: 0 0 15px 0;
            font-size: 16px;
          }
          p {
            color: #666;
            margin: 0 0 15px 0;
            font-size: 13px;
          }
          input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
            margin-bottom: 15px;
          }
          input:focus {
            outline: none;
            border-color: #4CAF50;
          }
          .buttons {
            display: flex;
            gap: 10px;
          }
          button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .cancel {
            background: #f0f0f0;
            color: #333;
          }
          .cancel:hover {
            background: #e0e0e0;
          }
          .submit {
            background: #4CAF50;
            color: white;
          }
          .submit:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🔐 Local OAuth</h2>
          <p>${message}</p>
          <input type="text" id="input" placeholder="Enter ${field.toLowerCase()}" />
          <div class="buttons">
            <button class="cancel" onclick="window.close()">Cancel</button>
            <button class="submit" onclick="submit()">Continue</button>
          </div>
        </div>
        <script>
          const input = document.getElementById('input');
          input.focus();
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              submit();
            }
          });
          function submit() {
            const value = input.value.trim();
            if (value) {
              window.electronAPI?.inputResult(value);
              window.close();
            }
          }
        </script>
      </body>
    </html>`);

    // Preload script for IPC
    const preloadPath = require('path').join(__dirname, 'input-preload.js');
    if (!require('fs').existsSync(preloadPath)) {
      // Create preload file if it doesn't exist
      require('fs').writeFileSync(
        preloadPath,
        `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  inputResult: (value) => ipcRenderer.send('input-result', value)
});
`
      );
    }

    let completed = false;

    inputWindow.once('ready-to-show', () => {
      inputWindow.show();
    });

    inputWindow.on('closed', () => {
      if (!completed) {
        resolve(null);
      }
    });

    // Listen for IPC message from preload
    const { ipcMain } = require('electron');
    ipcMain.once('input-result', (event, value) => {
      completed = true;
      inputWindow.destroy();
      resolve(value);
    });

    // Fallback: close window after 5 minutes
    setTimeout(() => {
      if (!completed && inputWindow && !inputWindow.isDestroyed()) {
        resolve(null);
        inputWindow.destroy();
      }
    }, 5 * 60 * 1000);
  });
}

module.exports = startServer;
