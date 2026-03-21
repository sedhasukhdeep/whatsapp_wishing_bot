const { Router } = require('express');
const { client, getStatus, handleDetachedFrame } = require('../client');

const router = Router();

router.get('/group-members/:chatId', async (req, res) => {
  const { ready } = getStatus();
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected' });

  const { chatId } = req.params;
  try {
    let chat;
    try {
      chat = await client.getChatById(chatId);
    } catch (_) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (!chat.isGroup) {
      return res.status(400).json({ error: 'Chat is not a group' });
    }
    const participants = (chat.participants || []).map((p) => ({
      jid: p.id._serialized,
      phone: '+' + p.id.user,
    }));
    return res.json({ group_name: chat.name, participants });
  } catch (err) {
    console.error('[WA] group-members error for chatId:', chatId, err.message);
    if (err.message && err.message.includes('detached Frame')) {
      handleDetachedFrame();
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.get('/wa-contacts', async (_req, res) => {
  const { ready } = getStatus();
  if (!ready) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  try {
    const contacts = await client.getContacts();
    const result = contacts
      .filter(c => c.isMyContact && !c.isGroup && c.isUser && c.number && !c.id._serialized.endsWith('@lid'))
      .map(c => ({
        phone: '+' + c.number,
        name: c.name || c.pushname || c.number,
        chat_id: c.id._serialized,
      }));
    const seen = new Set();
    const deduped = result.filter(c => seen.has(c.phone) ? false : seen.add(c.phone));

    // Remove phantom +1 variants (e.g. +161412345678 when +61412345678 exists)
    const phones = new Set(deduped.map(c => c.phone));
    const final = deduped.filter(c =>
      !(c.phone.startsWith('+1') && phones.has('+' + c.phone.slice(2)))
    );

    console.log('[WA] raw contacts:', result.length,
      '→ after exact dedup:', deduped.length,
      '→ after phantom+1 dedup:', final.length);
    const removed = deduped.filter(c =>
      c.phone.startsWith('+1') && phones.has('+' + c.phone.slice(2))
    );
    if (removed.length) {
      console.log('[WA] removed phantom+1:', removed.map(c => c.phone));
    }

    return res.json(final);
  } catch (err) {
    console.error('[WA] getContacts error:', err.message);
    if (err.message && err.message.includes('detached Frame')) {
      handleDetachedFrame();
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
