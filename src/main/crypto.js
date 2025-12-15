const os = require('os');
const path = require('path');
const fs = require('fs');

// Lazy-load the ES Module
let ed = null;
async function getEd25519() {
  if (!ed) {
    ed = await import('@noble/ed25519');
  }
  return ed;
}

/**
 * Get the path to the keypair file following ghostmrr pattern
 * Stores in ~/.local-oauth/keypair.json
 */
function getKeypairPath() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.local-oauth');
  return path.join(configDir, 'keypair.json');
}

/**
 * Load existing keypair or generate a new one
 */
async function loadOrCreateKeypair() {
  const keypairPath = getKeypairPath();
  const configDir = path.dirname(keypairPath);

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { mode: 0o700, recursive: true });
    console.log('[Crypto] Created config directory:', configDir);
  }

  // Try to load existing keypair
  if (fs.existsSync(keypairPath)) {
    try {
      const stored = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      const privateKey = Uint8Array.from(Buffer.from(stored.privateKey, 'base64'));
      const publicKey = Uint8Array.from(Buffer.from(stored.publicKey, 'base64'));

      console.log('[Crypto] Loaded existing keypair from:', keypairPath);

      return {
        privateKey,
        publicKey,
        publicKeyBase64: stored.publicKey,
      };
    } catch (error) {
      console.warn('[Crypto] Existing keypair file is corrupted. Generating new keypair...');
    }
  }

  // Generate new keypair
  console.log('[Crypto] Generating new ED25519 keypair...');
  const ed25519 = await getEd25519();
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

  // Save keypair
  const keypairData = {
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: publicKeyBase64,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(keypairPath, JSON.stringify(keypairData, null, 2), {
    mode: 0o600, // Owner read/write only
  });

  console.log('[Crypto] Keypair saved to:', keypairPath);

  return {
    privateKey,
    publicKey,
    publicKeyBase64,
  };
}

/**
 * Sign a message with the private key
 */
async function signMessage(message, privateKey) {
  const ed25519 = await getEd25519();
  const messageBytes = new TextEncoder().encode(JSON.stringify(message));
  const signature = await ed25519.signAsync(messageBytes, privateKey);
  return Buffer.from(signature).toString('base64');
}

/**
 * Reset keypair by deleting the file
 */
function resetKeypair() {
  const keypairPath = getKeypairPath();

  if (fs.existsSync(keypairPath)) {
    fs.unlinkSync(keypairPath);
    console.log('[Crypto] Keypair reset - file deleted');
    return true;
  }

  return false;
}

module.exports = {
  getKeypairPath,
  loadOrCreateKeypair,
  signMessage,
  resetKeypair,
};
