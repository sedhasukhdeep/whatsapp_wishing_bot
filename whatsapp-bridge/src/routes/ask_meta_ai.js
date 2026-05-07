/**
 * POST /ask-meta-ai
 *
 * Send a prompt to Meta AI's WhatsApp chat and wait for its reply.
 * Uses a pending-response map so the message listener can resolve the request.
 *
 * Body: { profile_id, chat_id, prompt, timeout_ms? }
 * Response: { text: string }
 */
const { Router } = require('express');
const { getStatus, sendMessageRaw, registerMetaListener, unregisterMetaListener, findMetaAiChat } = require('../sessions');

const router = Router();

/**
 * GET /find-meta-ai?profileId=1
 *
 * Search all chats for the Meta AI contact by name.
 * Returns { chatId, name } if found, or 404.
 * Use this to auto-detect the correct regional Meta AI chat ID.
 */
router.get('/find-meta-ai', async (req, res) => {
  const profileId = parseInt(req.query.profileId, 10);
  if (!profileId) return res.status(400).json({ error: 'profileId is required' });

  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected — scan QR code first' });

  try {
    const result = await findMetaAiChat(profileId);
    if (!result) return res.status(404).json({ error: 'Meta AI chat not found. Make sure you have started a conversation with Meta AI in WhatsApp.' });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/ask-meta-ai', async (req, res) => {
  const { profile_id, chat_id, prompt, timeout_ms = 60000 } = req.body;

  if (!profile_id) return res.status(400).json({ error: 'profile_id is required' });
  if (!chat_id)    return res.status(400).json({ error: 'chat_id is required' });
  if (!prompt)     return res.status(400).json({ error: 'prompt is required' });

  const profileId = parseInt(profile_id, 10);
  const { ready } = getStatus(profileId);
  if (!ready) return res.status(503).json({ error: 'WhatsApp not connected — scan QR code first' });

  try {
    const text = await askMetaAI(profileId, chat_id, prompt.trim(), parseInt(timeout_ms, 10));
    return res.json({ text });
  } catch (err) {
    const status = err.message.includes('Timeout') ? 504 : 500;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * Send prompt to Meta AI chat and await its response.
 * Registers a one-shot listener so the reply is captured before webhook forwarding.
 */
function askMetaAI(profileId, chatId, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unregisterMetaListener(profileId);
      reject(new Error(`Timeout waiting for Meta AI response (${timeoutMs}ms)`));
    }, timeoutMs);

    registerMetaListener(profileId, chatId, (text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(text);
    });

    // Send the message AFTER registering the listener to avoid race conditions
    sendMessageRaw(profileId, chatId, prompt).catch((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unregisterMetaListener(profileId);
      reject(err);
    });
  });
}

module.exports = router;
