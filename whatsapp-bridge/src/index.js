require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const express = require('express');
const { SESSION_BASE, initSession, destroyAll } = require('./sessions');
const { cleanStaleLocks } = require('./cleanStaleLocks');
const statusRouter = require('./routes/status');
const sendRouter = require('./routes/send');
const chatsRouter = require('./routes/chats');
const sendGifRouter = require('./routes/send_gif');
const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');
const sessionsRouter = require('./routes/sessions');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.json());
app.use(statusRouter);
app.use(sendRouter);
app.use(chatsRouter);
app.use(sendGifRouter);
app.use(contactsRouter);
app.use(messagesRouter);
app.use(sessionsRouter);

app.listen(PORT, HOST, () => {
  console.log(`[Bridge] Listening on http://${HOST}:${PORT}`);
});

// ── Session auto-discovery ─────────────────────────────────────────────────────

/**
 * Migrate the legacy single-session directory (session/session) to
 * the profile_1 session directory (session/session-profile_1) if needed.
 */
function migrateLegacySession() {
  const legacy = path.join(SESSION_BASE, 'session');
  const profile1 = path.join(SESSION_BASE, 'session-profile_1');
  if (fs.existsSync(legacy) && !fs.existsSync(profile1)) {
    try {
      fs.renameSync(legacy, profile1);
      console.log('[Bridge] Migrated legacy session → session-profile_1');
    } catch (err) {
      console.error('[Bridge] Failed to migrate legacy session:', err.message);
    }
  }
}

/**
 * Scan session/ for session-profile_N directories and return profile IDs.
 */
function discoverProfileIds() {
  const ids = [];
  try {
    const entries = fs.readdirSync(SESSION_BASE, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = e.name.match(/^session-profile_(\d+)$/);
      if (m) ids.push(parseInt(m[1], 10));
    }
  } catch { /* session dir may not exist yet */ }
  return ids;
}

async function bootstrap() {
  // 1. Migrate old single-session layout
  migrateLegacySession();

  // 2. Find existing profile sessions and start them
  const profileIds = discoverProfileIds();
  if (profileIds.length === 0) {
    console.log('[Bridge] No existing sessions found. Profiles must connect via /sessions/:id/init');
  } else {
    console.log('[Bridge] Auto-starting sessions for profiles:', profileIds);
    for (const profileId of profileIds) {
      // Clean stale lock files before init
      const sessionDir = path.join(SESSION_BASE, `session-profile_${profileId}`, 'session');
      cleanStaleLocks(sessionDir);
      await initSession(profileId);
    }
  }
}

bootstrap().catch((err) => console.error('[Bridge] Bootstrap error:', err));

// Graceful shutdown
async function shutdown(signal) {
  console.log(`[Bridge] ${signal} received — shutting down gracefully`);
  await destroyAll();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
