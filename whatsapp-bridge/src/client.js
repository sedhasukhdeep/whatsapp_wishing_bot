const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

let isReady = false;
let currentQR = null;
let state = 'starting';

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '..', 'session'),
  }),
  puppeteer: {
    headless: true,
    protocolTimeout: 60000,
    // When PUPPETEER_EXECUTABLE_PATH is set (e.g. in Docker), use system Chromium
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    }),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  },
});

client.on('qr', async (qrString) => {
  console.log('[WA] QR received — scan with WhatsApp');
  isReady = false;
  state = 'qr';
  try {
    currentQR = await qrcode.toDataURL(qrString);
  } catch (err) {
    console.error('[WA] QR encode error:', err);
  }
});

client.on('ready', () => {
  console.log('[WA] Client ready');
  isReady = true;
  currentQR = null;
  state = 'ready';
});

client.on('authenticated', () => {
  console.log('[WA] Authenticated');
  currentQR = null;
});

client.on('auth_failure', (msg) => {
  console.error('[WA] Auth failure:', msg);
  isReady = false;
  state = 'error';
});

client.on('disconnected', (reason) => {
  console.warn('[WA] Disconnected:', reason);
  isReady = false;
  currentQR = null;
  state = 'disconnected';
  setTimeout(() => {
    state = 'starting';
    client.initialize().catch((err) => console.error('[WA] Re-init error:', err));
  }, 5000);
});

const BACKEND_URL = process.env.BACKEND_URL || '';

async function forwardToWebhook(msg) {
  if (!BACKEND_URL) return;
  // Use msg.id.remote — the chat the message belongs to.
  const chatId = msg.id.remote;

  // Fetch chat name (fast — uses cached in-memory state)
  let chatName = null;
  try {
    const chat = await msg.getChat();
    chatName = chat.name || null;
  } catch (_) {}

  const senderJid = msg.author || null; // non-null only for group messages
  const senderName = msg._data?.notifyName || null; // WhatsApp push name

  try {
    await fetch(`${BACKEND_URL}/api/admin/wa-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        body: msg.body,
        message_id: msg.id._serialized,
        timestamp: msg.timestamp,
        author: senderJid,
        chat_name: chatName,
        sender_name: senderName,
      }),
    });
  } catch (err) {
    console.warn('[WA] Webhook forward error:', err.message);
  }
}

// Incoming messages (from another account → this number)
client.on('message', forwardToWebhook);

// Self-sent messages (admin messages their own Saved Messages chat).
// Only forward if the body starts with a known bot command — this prevents
// the bot's own replies from being re-processed in an infinite loop.
const BOT_COMMANDS = ['list', 'approve', 'send', 'skip', 'regenerate', 'upcoming', 'help'];
client.on('message_create', async (msg) => {
  if (!msg.fromMe) return;
  const firstWord = msg.body.trim().toLowerCase().split(/\s+/)[0];
  if (!BOT_COMMANDS.includes(firstWord)) return;
  await forwardToWebhook(msg);
});

function getStatus() {
  return { ready: isReady, qr_image: currentQR, state };
}

/**
 * Call when a Puppeteer "detached Frame" error is caught in a route.
 * Marks the client as not ready and schedules a re-initialisation so the
 * bridge recovers without a manual restart.
 */
function handleDetachedFrame() {
  if (isReady) {
    console.warn('[WA] Detached frame detected — marking not ready, re-initialising in 5s');
    isReady = false;
    state = 'disconnected';
    currentQR = null;
    setTimeout(() => {
      state = 'starting';
      client.initialize().catch((err) => console.error('[WA] Re-init error:', err));
    }, 5000);
  }
}

async function sendMessage(chatId, message) {
  if (!isReady) throw new Error('Client not ready');
  return client.sendMessage(chatId, message);
}

module.exports = { client, getStatus, sendMessage, handleDetachedFrame };
