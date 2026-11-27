import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { app } from './app.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const servesWeb = process.env.SERVE_WEB === '1';

if (servesWeb) {
  app.get('/api/*', (c) => c.notFound());
  app.get('*', serveStatic({ root: fileURLToPath(new URL('../dist/', import.meta.url)) }));
}

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  const name = servesWeb ? 'JLPT Atlas' : 'Anthropic quiz API (Hono)';
  console.log(`${name} running at http://${info.address}:${info.port}`);
});
