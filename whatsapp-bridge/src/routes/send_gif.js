const { Router } = require('express');
const { getStatus, sendGif } = require('../sessions');

const router = Router();

const CHAT_ID_PATTERN = /^[\d\-]+@(c|g)\.us$/;

router.post('/send-gif', async (req, res) => {
  const { profile_id, chat_id, gif_url, caption = '' } = req.body;

  if (!profile_id) return res.status(400).json({ error: 'profile_id is required' });
  if (!chat_id || !gif_url) return res.status(400).json({ error: 'chat_id and gif_url are required' });
  if (!CHAT_ID_PATTERN.test(chat_id)) return res.status(400).json({ error: 'Invalid chat_id format' });

  const profileId = parseInt(profile_id, 10);
  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected' });

  try {
    const msg = await sendGif(profileId, chat_id, gif_url, caption);
    return res.json({ success: true, message_id: msg?.id?._serialized ?? null });
  } catch (err) {
    console.error(`[WA:${profileId}] send-gif error:`, err);
    return res.status(500).json({ error: `Failed to send GIF: ${err.message}` });
  }
});

module.exports = router;
