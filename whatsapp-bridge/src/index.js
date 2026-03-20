require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const express = require('express');
const { client } = require('./client');
const { cleanStaleLocks } = require('./cleanStaleLocks');
const statusRouter = require('./routes/status');
const sendRouter = require('./routes/send');
const chatsRouter = require('./routes/chats');
const sendGifRouter = require('./routes/send_gif');
const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');

const PORT = process.env.PORT || 3001;
// In Docker, bind to all interfaces; otherwise localhost-only for security
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.json());
app.use(statusRouter);
app.use(sendRouter);
app.use(chatsRouter);
app.use(sendGifRouter);
app.use(contactsRouter);
app.use(messagesRouter);

app.listen(PORT, HOST, () => {
  console.log(`[Bridge] Listening on http://${HOST}:${PORT}`);
});

// Remove any stale Chromium lock files left by a previous crash before initialising
const SESSION_DIR = path.join(__dirname, '..', 'session', 'session');
cleanStaleLocks(SESSION_DIR);

async function initWithRetry(attemptsLeft = 3) {
  try {
    await client.initialize();
  } catch (err) {
    console.error(`[WA] Initialization error (${attemptsLeft} attempts left):`, err.message);
    if (attemptsLeft <= 1) { process.exit(1); }
    setTimeout(() => initWithRetry(attemptsLeft - 1), 10_000);
  }
}
initWithRetry();

// Graceful shutdown — lets whatsapp-web.js terminate Chrome cleanly so lock files are removed
async function shutdown(signal) {
  console.log(`[Bridge] ${signal} received — shutting down gracefully`);
  try { await client.destroy(); } catch { /* ignore */ }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
