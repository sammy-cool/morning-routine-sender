// monitoring/bull-board.js
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { emailQueue } = require("../email-core/emailQueue");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

module.exports = { serverAdapter };

// In index.js, add:
// const { serverAdapter } = require('./monitoring/bull-board');
// app.use('/admin/queues', serverAdapter.getRouter());
// Access dashboard at: http://localhost:3000/admin/queues
