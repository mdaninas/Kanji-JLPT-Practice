import { serve } from '@hono/node-server';

import { app } from './app.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`Anthropic quiz API (Hono) running at http://${info.address}:${info.port}`);
});
