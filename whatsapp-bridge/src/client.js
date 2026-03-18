const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

let isReady = false;
let currentQR = null;

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
});

client.on('authenticated', () => {
  console.log('[WA] Authenticated');
  currentQR = null;
});

client.on('auth_failure', (msg) => {
  console.error('[WA] Auth failure:', msg);
  isReady = false;
});

client.on('disconnected', (reason) => {
  console.warn('[WA] Disconnected:', reason);
  isReady = false;
  currentQR = null;
  client.initialize().catch((err) => console.error('[WA] Re-init error:', err));
});

const BACKEND_URL = process.env.BACKEND_URL || '';

async function forwardToWebhook(msg) {
  if (!BACKEND_URL) return;
  // Use msg.id.remote — the chat the message belongs to — so self-sent
  // messages (admin messaging their own Saved Messages) are identified
  // by the same chat_id as messages received from another account.
  const chatId = msg.id.remote;
  try {
    await fetch(`${BACKEND_URL}/api/admin/wa-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, body: msg.body, message_id: msg.id._serialized }),
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
  return { ready: isReady, qr_image: currentQR };
}

async function sendMessage(chatId, message) {
  if (!isReady) throw new Error('Client not ready');
  return client.sendMessage(chatId, message);
}

module.exports = { client, getStatus, sendMessage };
