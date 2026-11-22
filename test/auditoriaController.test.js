import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import { getAuditEvents } from '../controllers/auditoriaController.js';

test('invalid calendar dates are rejected before querying audit data', async (t) => {
  let queried = false;
  t.mock.method(pool, 'query', async () => {
    queried = true;
    return { rows: [] };
  });
  t.mock.method(console, 'error', () => {});

  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await getAuditEvents({ query: { fechaDesde: '2025-02-31' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(queried, false);
});
