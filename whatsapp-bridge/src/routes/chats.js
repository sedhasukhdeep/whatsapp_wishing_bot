const { Router } = require('express');
const { client, getStatus } = require('../client');

const router = Router();

router.get('/chats', async (_req, res) => {
  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  // getChats() can fail transiently while WA Web is still syncing — retry once
  let chats;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      chats = await client.getChats();
      break;
    } catch (err) {
      console.error(`[WA] getChats error (attempt ${attempt}):`, err.message);
      if (attempt === 2) {
        return res.status(500).json({ error: err.message });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  try {
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
    console.error('[WA] getChats mapping error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
