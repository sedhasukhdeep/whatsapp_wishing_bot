const { Router } = require('express');
const { getStatus } = require('../sessions');

const router = Router();

// GET /status?profileId=1 — per-profile bridge status (QR image + ready flag)
router.get('/status', (req, res) => {
  const profileId = parseInt(req.query.profileId, 10);
  if (isNaN(profileId)) return res.status(400).json({ error: 'profileId query param is required' });
  res.json(getStatus(profileId));
});

module.exports = router;
