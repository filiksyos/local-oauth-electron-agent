# Local OAuth - Electron Agent

🔐 Revolutionary local OAuth system - Electron app providing cryptographic identity verification on port 5000.

## Overview

This is the **Electron OAuth Agent** part of the Local OAuth system. It runs in the background on `localhost:5000` and handles:

- 🔑 **ED25519 Keypair Generation** - Creates and manages cryptographic keys
- 🪟 **Native System Dialogs** - Shows native OS dialog for user input
- ✍️ **Message Signing** - Signs user data with ED25519
- 🌐 **Express HTTP Server** - Provides `/oauth` endpoint for web app

## Features

- ✅ **ED25519 Cryptography** - Uses @noble/ed25519 for signing
- ✅ **Persistent Keypair** - Stores keypair at `~/.local-oauth/keypair.json`
- ✅ **Native OS Dialogs** - Beautiful native dialog boxes
- ✅ **CORS Support** - Configured for localhost:3000
- ✅ **Express Server** - Simple, lightweight HTTP server

## Prerequisites

1. **Node.js** 20+ installed
2. **Electron** 31+ (installed via npm)

## Installation

```bash
# Install dependencies
npm install

# Run development mode
npm run dev

# Or start as background process
npm start
```

The OAuth agent will start on `http://localhost:5000`

## How It Works

### 1. Web app sends OAuth request

Web app on localhost:3000 sends:

```bash
curl -X POST http://localhost:5000/oauth \
  -H "Content-Type: application/json" \
  -d '{"nonce": "uuid-here"}'
```

### 2. Electron shows system dialog

Native OS dialog prompts for:
- Name
- Email

### 3. Message is signed with ED25519

```javascript
const message = {
  name: "John Doe",
  email: "john@example.com",
  timestamp: "2025-01-15T10:30:00Z",
  nonce: "uuid-here"
};

const signature = await ed.signAsync(messageBytes, privateKey);
```

### 4. Signed response returned

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "publicKey": "base64-encoded-public-key",
  "timestamp": "2025-01-15T10:30:00Z",
  "signature": "base64-encoded-signature",
  "nonce": "uuid-here"
}
```

### 5. Web app verifies signature

Web app uses `@noble/ed25519` to verify the signature and create a session.

## Tech Stack

- **Electron** 31.0.0 - Desktop app framework
- **Express** ^4.18.2 - HTTP server
- **@noble/ed25519** ^2.3.0 - ED25519 signature generation (matching ghostmrr)
- **dotenv** ^16.3.1 - Environment configuration
- **electron-builder** ^24.9.1 - Build and packaging

## Project Structure

```
local-oauth-electron-agent/
├── src/
│   └── main/
│       ├── index.js              # Electron main process
│       ├── crypto.js             # ED25519 keypair management
│       ├── server.js             # Express OAuth server
│       └── input-preload.js      # Preload for input dialogs
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## API Endpoints

### POST /oauth

OAuth endpoint for identity verification.

**Request:**
```json
{
  "nonce": "uuid-string-for-replay-protection"
}
```

**Response (Success):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "publicKey": "base64-public-key",
  "timestamp": "2025-01-15T10:30:00Z",
  "signature": "base64-signature",
  "nonce": "uuid-string"
}
```

**Response (User Cancelled):**
```json
{
  "error": "User cancelled identity verification"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Local OAuth Agent"
}
```

## Keypair Management

### Storage

Keypairs are stored at:
```
~/.local-oauth/keypair.json
```

File permissions: `0o600` (owner read/write only)

### Format

```json
{
  "privateKey": "base64-encoded-private-key",
  "publicKey": "base64-encoded-public-key",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Reset Keypair

To generate a new keypair, delete the file:

```bash
rm ~/.local-oauth/keypair.json
```

Restart the Electron app to generate a new keypair.

## Development

### Dev Mode

```bash
npm run dev
```

Opens DevTools window for debugging.

### Build

```bash
npm run build
```

Builds installers for Mac, Windows, and Linux.

## CORS Configuration

Currently allows requests from:
- `http://localhost:3000` (Local OAuth Web App)

To add more origins, modify `src/main/server.js`:

```javascript
res.header('Access-Control-Allow-Origin', 'http://your-domain:port');
```

## Troubleshooting

### Port 5000 already in use

Find and kill the process:

```bash
# macOS/Linux
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Keypair file corrupted

Delete and restart:

```bash
rm ~/.local-oauth/keypair.json
```

### Dialog not showing

Ensure Electron app is running and hasn't minimized. Check logs:

```bash
npm run dev
```

## Related

- [Local OAuth Web App](https://github.com/filiksyos/local-oauth-web-app) - Companion Next.js app
- [GhostMRR](https://github.com/filiksyos/ghostmrr) - Inspiration for ED25519 implementation

## License

MIT

---

**Built with ❤️ using GitMVP**
