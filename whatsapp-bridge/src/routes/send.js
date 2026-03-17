const { Router } = require('express');
const { getStatus, sendMessage } = require('../client');

const router = Router();

router.post('/send', async (req, res) => {
  const { chat_id, message } = req.body;

  if (!chat_id || !message) {
    return res.status(400).json({ error: 'chat_id and message are required' });
  }

  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected — scan QR code first' });
  }

  try {
    const result = await sendMessage(chat_id, message);
    return res.json({ success: true, message_id: result.id?.id ?? null });
  } catch (err) {
    console.error('[WA] Send error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
