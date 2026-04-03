const { Router } = require('express');
const { getStatus, getChatById, handleDetachedFrame } = require('../sessions');

const router = Router();

/** Races a promise against a timeout; rejects with Error if the timeout fires first. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`fetchMessages timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// GET /messages/:chatId?profileId=1&limit=200
router.get('/messages/:chatId', async (req, res) => {
  const profileId = parseInt(req.query.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'profileId query param is required' });

  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected' });

  const { chatId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);

  try {
    let chat;
    try {
      chat = await getChatById(profileId, chatId);
    } catch (_) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await withTimeout(chat.fetchMessages({ limit }), 30000);
    const result = messages
      .filter((m) => m.type === 'chat' && m.body && m.body.trim())
      .map((m) => ({
        id: m.id._serialized,
        body: m.body,
        timestamp: m.timestamp,
        from_me: m.fromMe,
        author: m.author || null,
        sender_name: m._data?.notifyName || null,
      }));

    return res.json({ chat_name: chat.name || null, messages: result });
  } catch (err) {
    console.error('[WA] fetchMessages error for chatId:', chatId, err.message);
    if (err.message && err.message.includes('detached Frame')) {
      handleDetachedFrame(profileId);
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
