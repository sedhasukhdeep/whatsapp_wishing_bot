const { Router } = require('express');
const { getStatus, getChats, handleDetachedFrame } = require('../sessions');

const router = Router();

router.get('/chats', async (req, res) => {
  const profileId = parseInt(req.query.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'profileId query param is required' });

  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected' });

  let chats;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      chats = await getChats(profileId);
      break;
    } catch (err) {
      console.error(`[WA:${profileId}] getChats error (attempt ${attempt}):`, err.message);
      if (err.message && err.message.includes('detached Frame')) {
        handleDetachedFrame(profileId);
        return res.status(503).json({ error: 'WhatsApp not connected' });
      }
      if (attempt === 2) return res.status(500).json({ error: err.message });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  try {
    const result = chats.map((chat) => ({
      id: chat.id._serialized,
      name: chat.name,
      type: chat.isGroup ? 'group' : 'individual',
    }));
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'individual' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return res.json(result);
  } catch (err) {
    console.error(`[WA:${profileId}] getChats mapping error:`, err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
