require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const { client } = require('./client');
const statusRouter = require('./routes/status');
const sendRouter = require('./routes/send');
const chatsRouter = require('./routes/chats');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(statusRouter);
app.use(sendRouter);
app.use(chatsRouter);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Bridge] Listening on http://127.0.0.1:${PORT}`);
});

client.initialize().catch((err) => {
  console.error('[WA] Initialization error:', err);
  process.exit(1);
});
