const serverless = require('serverless-http');
const { createApp } = require('../../server-core');

const app = createApp();

module.exports.handler = serverless(app);
