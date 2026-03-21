const { Router } = require('express');
const { getStatus, sendMessage } = require('../sessions');

const router = Router();

const MAX_MESSAGE_LENGTH = 4096;
const CHAT_ID_PATTERN = /^[\d\-]+@(c|g)\.us$/;

router.post('/send', async (req, res) => {
  const { profile_id, chat_id, message } = req.body;

  if (!profile_id) return res.status(400).json({ error: 'profile_id is required' });
  if (!chat_id || !message) return res.status(400).json({ error: 'chat_id and message are required' });
  if (typeof message !== 'string' || message.trim().length === 0)
    return res.status(400).json({ error: 'message must be a non-empty string' });
  if (message.length > MAX_MESSAGE_LENGTH)
    return res.status(400).json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
  if (!CHAT_ID_PATTERN.test(chat_id))
    return res.status(400).json({ error: 'chat_id must be in the format <number>@c.us or <number>@g.us' });

  const profileId = parseInt(profile_id, 10);
  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected — scan QR code first' });

  try {
    const result = await sendMessage(profileId, chat_id, message);
    return res.json({ success: true, message_id: result.id?.id ?? null });
  } catch (err) {
    console.error(`[WA:${profileId}] Send error:`, err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
