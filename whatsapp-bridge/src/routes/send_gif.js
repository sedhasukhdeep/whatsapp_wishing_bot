const express = require('express');
const { MessageMedia } = require('whatsapp-web.js');
const { getStatus } = require('../client');

const router = express.Router();

const CHAT_ID_PATTERN = /^[\d\-]+@(c|g)\.us$/;

router.post('/send-gif', async (req, res) => {
  const { chat_id, gif_url, caption = '' } = req.body;

  if (!chat_id || !gif_url) {
    return res.status(400).json({ error: 'chat_id and gif_url are required' });
  }

  if (!CHAT_ID_PATTERN.test(chat_id)) {
    return res.status(400).json({ error: 'Invalid chat_id format' });
  }

  const { ready, client } = getStatus();
  if (!ready || !client) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }

  try {
    const media = await MessageMedia.fromUrl(gif_url, { unsafeMime: true });
    const msg = await client.sendMessage(chat_id, media, { caption, sendVideoAsGif: true });
    return res.json({ success: true, message_id: msg?.id?._serialized ?? null });
  } catch (err) {
    console.error('[WA] send-gif error:', err);
    return res.status(500).json({ error: `Failed to send GIF: ${err.message}` });
  }
});

module.exports = router;
