import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import reportesRoutes from '../routes/reportes.js';

test('report exports are mounted at canonical and legacy prefixes and reject GET clearly', async (t) => {
  const app = express();
  app.use('/api/reportes', reportesRoutes);
  app.use('/reportes', reportesRoutes);
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();

  for (const path of ['/api/reportes/export', '/reportes/export']) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    const payload = await response.json();

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.match(payload.message, /requiere POST/);
  }
});
