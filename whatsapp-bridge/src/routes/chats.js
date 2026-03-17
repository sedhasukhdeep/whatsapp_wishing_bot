const { Router } = require('express');
const { client, getStatus } = require('../client');

const router = Router();

router.get('/chats', async (_req, res) => {
  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  try {
    const chats = await client.getChats();
    const result = chats.map((chat) => ({
      id: chat.id._serialized,
      name: chat.name,
      type: chat.isGroup ? 'group' : 'individual',
    }));
    // Sort: individuals first, then groups; alphabetically within each
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'individual' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return res.json(result);
  } catch (err) {
    console.error('[WA] getChats error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
