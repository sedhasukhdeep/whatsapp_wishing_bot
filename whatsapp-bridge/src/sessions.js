/**
 * Multi-session WhatsApp client manager.
 * One Client instance per profile, sessions stored under session/session-profile_<id>/.
 */
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const SESSION_BASE = path.join(__dirname, '..', 'session');
const BACKEND_URL = process.env.BACKEND_URL || '';
const BOT_COMMANDS = ['list', 'approve', 'send', 'skip', 'regenerate', 'upcoming', 'help'];

// Map<profileId: number, SessionState>
// SessionState: { client, isReady, currentQR, state }
const sessions = new Map();

// Map<profileId, { chatId, callback }> — one-shot listeners for Meta AI replies
const metaListeners = new Map();

async function _forwardToWebhook(msg, profileId) {
  if (!BACKEND_URL) return;
  const chatId = msg.id.remote;
  let chatName = null;
  try {
    const chat = await msg.getChat();
    chatName = chat.name || null;
  } catch (_) {}

  try {
    await fetch(`${BACKEND_URL}/api/admin/wa-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        chat_id: chatId,
        body: msg.body,
        message_id: msg.id._serialized,
        timestamp: msg.timestamp,
        author: msg.author || null,
        chat_name: chatName,
        sender_name: msg._data?.notifyName || null,
      }),
    });
  } catch (err) {
    console.warn(`[WA:${profileId}] Webhook forward error:`, err.message);
  }
}

function _createSession(profileId) {
  const state = { client: null, isReady: false, currentQR: null, state: 'starting' };

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `profile_${profileId}`,
      dataPath: SESSION_BASE,
    }),
    puppeteer: {
      headless: true,
      protocolTimeout: 60000,
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      }),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  });

  state.client = client;
  sessions.set(profileId, state);

  client.on('qr', async (qrString) => {
    console.log(`[WA:${profileId}] QR received — scan with WhatsApp`);
    state.isReady = false;
    state.state = 'qr';
    try { state.currentQR = await qrcode.toDataURL(qrString); }
    catch (err) { console.error(`[WA:${profileId}] QR encode error:`, err); }
  });

  client.on('ready', () => {
    console.log(`[WA:${profileId}] Client ready`);
    state.isReady = true;
    state.currentQR = null;
    state.state = 'ready';
  });

  client.on('authenticated', () => {
    console.log(`[WA:${profileId}] Authenticated`);
    state.currentQR = null;
  });

  client.on('auth_failure', (msg) => {
    console.error(`[WA:${profileId}] Auth failure:`, msg);
    state.isReady = false;
    state.state = 'error';
  });

  client.on('disconnected', (reason) => {
    console.warn(`[WA:${profileId}] Disconnected:`, reason);
    state.isReady = false;
    state.currentQR = null;
    state.state = 'disconnected';
    setTimeout(() => {
      state.state = 'starting';
      client.initialize().catch((err) => console.error(`[WA:${profileId}] Re-init error:`, err));
    }, 5000);
  });

  client.on('message', (msg) => {
    const fromId = msg.id.remote;
    // Check if there's a pending Meta AI request for this profile + chat
    const listener = metaListeners.get(profileId);
    if (listener && fromId === listener.chatId) {
      metaListeners.delete(profileId);
      listener.callback(msg.body);
      return; // Don't forward to webhook — this is a Meta AI response
    }
    _forwardToWebhook(msg, profileId);
  });
  client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    const firstWord = msg.body.trim().toLowerCase().split(/\s+/)[0];
    if (!BOT_COMMANDS.includes(firstWord)) return;
    await _forwardToWebhook(msg, profileId);
  });

  return state;
}

// ── Public API ────────────────────────────────────────────────────────────────

function getStatus(profileId) {
  const s = sessions.get(profileId);
  if (!s) return { ready: false, qr_image: null, state: 'not_initialized' };
  return { ready: s.isReady, qr_image: s.currentQR, state: s.state };
}

function getAllStatuses() {
  const result = {};
  for (const [id, s] of sessions.entries()) {
    result[id] = { ready: s.isReady, state: s.state };
  }
  return result;
}

function handleDetachedFrame(profileId) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) return;
  console.warn(`[WA:${profileId}] Detached frame — re-initialising in 5s`);
  s.isReady = false;
  s.state = 'disconnected';
  s.currentQR = null;
  setTimeout(() => {
    s.state = 'starting';
    s.client.initialize().catch((err) => console.error(`[WA:${profileId}] Re-init error:`, err));
  }, 5000);
}

async function initSession(profileId, force = false) {
  let s = sessions.get(profileId);
  if (s) {
    if (!force && ['ready', 'starting', 'qr'].includes(s.state)) return s;
    // Force restart: destroy and recreate
    if (force) {
      console.log(`[WA:${profileId}] Force restart requested`);
      try { await s.client.destroy(); } catch { /* ignore */ }
      sessions.delete(profileId);
    } else {
      s.state = 'starting';
      s.client.initialize().catch((err) => console.error(`[WA:${profileId}] Re-init error:`, err));
      return s;
    }
  }
  s = _createSession(profileId);
  s.client.initialize().catch((err) => console.error(`[WA:${profileId}] Init error:`, err));
  return s;
}

async function destroySession(profileId) {
  const s = sessions.get(profileId);
  if (!s) return;
  try { await s.client.destroy(); } catch { /* ignore */ }
  sessions.delete(profileId);
  console.log(`[WA:${profileId}] Session destroyed`);
}

async function destroyAll() {
  for (const [id] of sessions.entries()) {
    await destroySession(id);
  }
}

async function sendMessage(profileId, chatId, message) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  return s.client.sendMessage(chatId, message);
}

async function sendGif(profileId, chatId, gifUrl, caption) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  const media = await MessageMedia.fromUrl(gifUrl, { unsafeMime: true });
  return s.client.sendMessage(chatId, media, { caption, sendVideoAsGif: true });
}

async function getContacts(profileId) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  return s.client.getContacts();
}

async function getChats(profileId) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  return s.client.getChats();
}

async function getChatById(profileId, chatId) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  return s.client.getChatById(chatId);
}

/**
 * Send a raw message without the CHAT_ID_PATTERN validation (Meta AI uses a normal @c.us ID).
 * Alias for internal use by ask_meta_ai route.
 */
async function sendMessageRaw(profileId, chatId, message) {
  const s = sessions.get(profileId);
  if (!s || !s.isReady) throw new Error('Client not ready');
  return s.client.sendMessage(chatId, message);
}

/**
 * Register a one-shot listener that resolves when the next message arrives
 * from `chatId` in the given profile's session.
 */
function registerMetaListener(profileId, chatId, callback) {
  metaListeners.set(profileId, { chatId, callback });
}

function unregisterMetaListener(profileId) {
  metaListeners.delete(profileId);
}

module.exports = {
  SESSION_BASE,
  getStatus,
  getAllStatuses,
  handleDetachedFrame,
  initSession,
  destroySession,
  destroyAll,
  sendMessage,
  sendMessageRaw,
  sendGif,
  getContacts,
  getChats,
  getChatById,
  registerMetaListener,
  unregisterMetaListener,
};
