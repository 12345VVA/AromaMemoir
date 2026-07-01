// 挑战端点集成测试（迁移自 weiji-server/tests/integration/challenge.test.ts）
//
// 适配说明：
// 1. 端点 /api/challenge/list → /app/challenge/list
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001
// 3. C 端 token 不带 Bearer 前缀
// 4. 旧工程断言字段 isActive/title/description/rules/startDate/endDate；
//    新工程 challenge 实体字段为 isActive/title/description/rules(json)/startDate/endDate
//    （cool-admin BaseEntity 额外含 id/createTime/updateTime）
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Challenge 端点', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('GET /app/challenge/list 返回激活状态的挑战数组', async () => {
    const res = await request
      .get('/app/challenge/list')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data)).toBe(true);

    // 仅返回 isActive=true 的挑战
    for (const ch of res.body.data) {
      expect(ch.isActive).toBe(true);
    }

    // 若种子非空，校验挑战结构
    if (res.body.data.length > 0) {
      const first = res.body.data[0];
      expect(first.id).toBeTruthy();
      // 新工程挑战实体字段：name / description / rules(json, 可为 null) / startTime / endTime
      expect(first.name).toBeTruthy();
      expect(first.description).toBeTruthy();
      expect(first.startTime).toBeTruthy();
      expect(first.endTime).toBeTruthy();
    }
  });

  it('GET /app/challenge/list 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/challenge/list');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });
});
