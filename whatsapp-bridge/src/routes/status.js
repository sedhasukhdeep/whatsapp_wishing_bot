const { Router } = require('express');
const { getStatus } = require('../client');

const router = Router();

router.get('/status', (_req, res) => {
  res.json(getStatus());
});

module.exports = router;
