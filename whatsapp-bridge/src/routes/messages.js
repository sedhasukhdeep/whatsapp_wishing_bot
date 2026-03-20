const { Router } = require('express');
const { client, getStatus } = require('../client');

const router = Router();

// GET /messages/:chatId?limit=200
// Returns text messages from a chat, newest-first, for historical occasion scanning.
router.get('/messages/:chatId', async (req, res) => {
  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }

  const { chatId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);

  try {
    const chats = await client.getChats();
    const chat = chats.find((c) => c.id._serialized === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await chat.fetchMessages({ limit });

    const result = messages
      .filter((m) => m.type === 'chat' && m.body && m.body.trim())
      .map((m) => ({
        id: m.id._serialized,
        body: m.body,
        timestamp: m.timestamp,
        from_me: m.fromMe,
        author: m.author || null, // sender JID in group chats (null for DMs)
      }));

    return res.json(result);
  } catch (err) {
    console.error(`[WA] fetchMessages error for ${chatId}:`, err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
