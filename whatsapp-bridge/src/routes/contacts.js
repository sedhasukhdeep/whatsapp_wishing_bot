const { Router } = require('express');
const { client, getStatus } = require('../client');

const router = Router();

router.get('/wa-contacts', async (_req, res) => {
  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  try {
    const contacts = await client.getContacts();
    const result = contacts
      .filter(c => c.isMyContact && !c.isGroup && c.isUser && c.number)
      .map(c => ({
        phone: '+' + c.number,
        name: c.name || c.pushname || c.number,
        chat_id: c.id._serialized,
      }));
    const seen = new Set();
    return res.json(result.filter(c => seen.has(c.phone) ? false : seen.add(c.phone)));
  } catch (err) {
    console.error('[WA] getContacts error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
