// 通用 helpers 单元测试（迁移自 weiji-server/tests/unit/helpers.test.ts）
//
// 适配说明：
// 旧工程 helpers.ts 提供 findById/findByField/filterBy/insert/updateById/
// softDelete/uuid 等内存数组操作，以及 common/response.ts 的 ok/fail/unauthorized/
// forbidden 响应包装。新工程改用 TypeORM Repository + cool-admin BaseController.ok()，
// 上述函数均无对应物（已废弃）。
//
// 新工程的通用工具位于 src/comm/utils.ts（Utils 单例类），提供 toCamelCase /
// matchUrl / extractJSONFromText / removeEmptyP / getRecentlyDates / getBetweenDays /
// sleep 等纯函数。本文件改为覆盖这些新工具方法。
import { Utils } from '../../src/comm/utils';

describe('Utils.toCamelCase', () => {
  it('下划线/中划线字段名转驼峰', () => {
    const u = new Utils();
    const r = u.toCamelCase({ a_b: 1, c_d: 2, 'e-f': 3 });
    expect(r).toEqual({ aB: 1, cD: 2, eF: 3 });
  });

  it('已是驼峰的不变', () => {
    const u = new Utils();
    const r = u.toCamelCase({ fooBar: 1 });
    expect(r).toEqual({ fooBar: 1 });
  });
});

describe('Utils.matchUrl', () => {
  const u = new Utils();

  it('静态路径完全匹配', () => {
    expect(u.matchUrl('/open/health', '/open/health')).toBe(true);
    expect(u.matchUrl('/open/health', '/open/other')).toBe(false);
  });

  it(':param 匹配任意非空段', () => {
    expect(u.matchUrl('/app/record/:id', '/app/record/1')).toBe(true);
    expect(u.matchUrl('/app/record/:id', '/app/other/1')).toBe(false);
  });

  it('** 匹配剩余所有部分', () => {
    expect(u.matchUrl('/open/**', '/open/health')).toBe(true);
    expect(u.matchUrl('/open/**', '/open/a/b/c')).toBe(true);
  });

  it('长度不一致且无 ** 返回 false', () => {
    expect(u.matchUrl('/app/user', '/app/user/profile')).toBe(false);
  });
});

describe('Utils.extractJSONFromText', () => {
  const u = new Utils();

  it('纯 JSON 文本直接解析', () => {
    expect(u.extractJSONFromText('{"a":1}')).toEqual({ a: 1 });
    expect(u.extractJSONFromText('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('从混合文本中提取首个 JSON 对象', () => {
    expect(u.extractJSONFromText('prefix {"b":2} suffix')).toEqual({ b: 2 });
  });

  it('无 JSON 返回 null', () => {
    expect(u.extractJSONFromText('no json here')).toBeNull();
    expect(u.extractJSONFromText('')).toBeNull();
    expect(u.extractJSONFromText(null as unknown as string)).toBeNull();
  });
});

describe('Utils.removeEmptyP', () => {
  it('删除 null / 空串 / "undefined" 字段', () => {
    const u = new Utils();
    const obj: any = { a: 1, b: '', c: null, d: 'undefined', e: 0, f: 'keep' };
    u.removeEmptyP(obj);
    expect(obj).toEqual({ a: 1, e: 0, f: 'keep' });
  });
});

describe('Utils.getRecentlyDates', () => {
  it('返回最近 N 天升序日期数组（YYYY-MM-DD）', () => {
    const u = new Utils();
    const dates = u.getRecentlyDates(3);
    expect(dates.length).toBe(3);
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 升序：dates[0] < dates[2]
    expect(dates[0] < dates[2]).toBe(true);
  });
});

describe('Utils.getBetweenDays', () => {
  it('返回闭区间日期集合', () => {
    const u = new Utils();
    const days = u.getBetweenDays('2026-07-01', '2026-07-03');
    expect(days).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});

describe('Utils.sleep', () => {
  it('阻塞指定毫秒后 resolve', async () => {
    const u = new Utils();
    const start = Date.now();
    await u.sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
