import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';

describe('GET /health', () => {
  it('应返回 200 和 status ok', async () => {
    const request = await createTestApp();
    const res = await request.get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    // ai 字段可能是 'up' 或 'down'，验证存在即可
    assert.ok(['up', 'down'].includes(res.body.ai));
  });
});
