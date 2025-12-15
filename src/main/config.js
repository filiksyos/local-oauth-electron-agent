const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Get the path to the config file
 * Stores in ~/.local-oauth/config.json
 */
function getConfigPath() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.local-oauth');
  return path.join(configDir, 'config.json');
}

/**
 * Load user config (email and name)
 * Returns null if config doesn't exist
 */
function loadConfig() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return {
      email: config.email || null,
      name: config.name || null,
      updatedAt: config.updatedAt || null,
    };
  } catch (error) {
    console.warn('[Config] Error loading config file:', error);
    return null;
  }
}

/**
 * Save user config (email and name)
 */
function saveConfig(email, name) {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { mode: 0o700, recursive: true });
    console.log('[Config] Created config directory:', configDir);
  }

  const configData = {
    email: email || null,
    name: name || null,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), {
    mode: 0o600, // Owner read/write only
  });

  console.log('[Config] Config saved to:', configPath);
  return configData;
}

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
};

