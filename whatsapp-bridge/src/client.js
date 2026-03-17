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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
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

function getStatus() {
  return { ready: isReady, qr_image: currentQR };
}

async function sendMessage(chatId, message) {
  if (!isReady) throw new Error('Client not ready');
  return client.sendMessage(chatId, message);
}

module.exports = { client, getStatus, sendMessage };
