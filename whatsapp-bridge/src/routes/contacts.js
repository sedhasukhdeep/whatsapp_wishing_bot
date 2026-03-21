const { Router } = require('express');
const { getStatus, getContacts, getChatById, handleDetachedFrame } = require('../sessions');

const router = Router();

function requireProfile(req, res) {
  const profileId = parseInt(req.query.profileId, 10);
  if (isNaN(profileId)) {
    res.status(400).json({ error: 'profileId query param is required' });
    return null;
  }
  const { ready } = getStatus(profileId);
  if (!ready) {
    res.status(503).json({ error: 'WhatsApp not connected' });
    return null;
  }
  return profileId;
}

router.get('/group-members/:chatId', async (req, res) => {
  const profileId = requireProfile(req, res);
  if (profileId === null) return;

  const { chatId } = req.params;
  try {
    let chat;
    try {
      chat = await getChatById(profileId, chatId);
    } catch (_) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (!chat.isGroup) return res.status(400).json({ error: 'Chat is not a group' });
    const participants = (chat.participants || []).map((p) => ({
      jid: p.id._serialized,
      phone: '+' + p.id.user,
    }));
    return res.json({ group_name: chat.name, participants });
  } catch (err) {
    console.error('[WA] group-members error for chatId:', chatId, err.message);
    if (err.message && err.message.includes('detached Frame')) {
      handleDetachedFrame(profileId);
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.get('/wa-contacts', async (req, res) => {
  const profileId = requireProfile(req, res);
  if (profileId === null) return;

  try {
    const contacts = await getContacts(profileId);
    const result = contacts
      .filter(c => c.isMyContact && !c.isGroup && c.isUser && c.number && !c.id._serialized.endsWith('@lid'))
      .map(c => ({
        phone: '+' + c.number,
        name: c.name || c.pushname || c.number,
        chat_id: c.id._serialized,
      }));
    const seen = new Set();
    const deduped = result.filter(c => seen.has(c.phone) ? false : seen.add(c.phone));
    const phones = new Set(deduped.map(c => c.phone));
    const final = deduped.filter(c =>
      !(c.phone.startsWith('+1') && phones.has('+' + c.phone.slice(2)))
    );
    console.log(`[WA:${profileId}] raw contacts:`, result.length,
      '→ after exact dedup:', deduped.length,
      '→ after phantom+1 dedup:', final.length);
    return res.json(final);
  } catch (err) {
    console.error('[WA] getContacts error:', err.message);
    if (err.message && err.message.includes('detached Frame')) {
      handleDetachedFrame(profileId);
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
