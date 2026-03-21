const { Router } = require('express');
const { getStatus, getAllStatuses, initSession, destroySession } = require('../sessions');

const router = Router();

// GET /sessions — list statuses for all active sessions
router.get('/sessions', (_req, res) => {
  res.json(getAllStatuses());
});

// GET /sessions/:profileId/status — QR + ready status for one profile
router.get('/sessions/:profileId/status', (req, res) => {
  const profileId = parseInt(req.params.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'Invalid profileId' });
  res.json(getStatus(profileId));
});

// POST /sessions/:profileId/init — start or re-init a session (returns current status)
// Pass ?force=true to destroy and recreate even if currently starting/qr
router.post('/sessions/:profileId/init', async (req, res) => {
  const profileId = parseInt(req.params.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'Invalid profileId' });
  const force = req.query.force === 'true';
  await initSession(profileId, force);
  res.json(getStatus(profileId));
});

// DELETE /sessions/:profileId — disconnect and remove a session
router.delete('/sessions/:profileId', async (req, res) => {
  const profileId = parseInt(req.params.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'Invalid profileId' });
  await destroySession(profileId);
  res.json({ ok: true });
});

module.exports = router;
