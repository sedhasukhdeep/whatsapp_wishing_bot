const { Router } = require('express');
const { destroyAll } = require('../sessions');

const router = Router();

// POST /admin/restart — gracefully shut down (Docker restart policy brings it back)
router.post('/admin/restart', async (_req, res) => {
  res.json({ ok: true, message: 'Bridge restarting...' });
  setTimeout(async () => {
    console.log('[Bridge] Restart requested via API — shutting down');
    try { await destroyAll(); } catch { /* ignore */ }
    process.exit(0);
  }, 300);
});

module.exports = router;
