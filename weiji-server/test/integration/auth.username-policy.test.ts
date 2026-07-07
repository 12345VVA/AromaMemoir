// AppAuthService.register 用户名策略集成测试
//
// 测试策略说明：
// 项目当前无 midwayjs 测试 bootstrap / supertest HTTP 集成测试基础设施（需 DB
// mock 等大量工作）。本文件作为"服务层集成测试"，直接 new AppAuthService()
// 并 mock 掉 appUserEntity Repository 与 midwayCache，验证 validateUsername
// 已正确串联到注册流程：保留词 / 敏感词命中时抛 CoolCommException + 通用错误
// 消息，正常用户名走完 save → generateToken → cache.set 流程并返回 token。
//
// 这能在不依赖 HTTP / DB 基础设施的前提下验证 spec 中的核心断言：
// 1. 注册名为 admin / 敏感词 → 抛 CoolCommException + 通用错误消息
// 2. 注册名为正常名 → 调用 repo.save 并返回 token
// 3. 重复用户名 → 抛相同通用错误（防枚举）
import { AppAuthService } from '../../src/modules/account/service/auth';
import { CoolCommException } from '@cool-midway/core';
import { RegisterDTO } from '../../src/modules/account/dto/register';

// jest 无全局 fail，定义本地 fail 用于"不应执行到此"的断言
const fail = (msg: string): never => {
  throw new Error(msg);
};

// 简化的 mock Repository：模拟 typeorm Repository 的 findOneBy / save
function createMockRepo() {
  return {
    // 默认用户名不重复
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((data) => ({
      id: 1,
      ...data,
      passwordV: 1,
      createTime: new Date(),
    })),
  };
}

// 简化的 mock midwayCache：register 仅用到 set
function createMockCache() {
  return {
    set: jest.fn().mockResolvedValue(undefined),
  };
}

// 构造一个完成依赖注入的 AppAuthService 实例
function createService() {
  const service = new AppAuthService();
  (service as any).appUserEntity = createMockRepo();
  (service as any).midwayCache = createMockCache();
  (service as any).coolConfig = {
    jwt: {
      token: { expire: 3600 },
      secret: 'test-secret-for-jest',
    },
  };
  return service;
}

// 通用错误消息（与 auth.ts 内字面量保持一致，便于多处断言）
const GENERIC_ERR_MSG = '注册失败，请检查输入或更换用户名';

describe('AppAuthService.register - 用户名策略集成', () => {
  let service: AppAuthService;

  beforeEach(() => {
    service = createService();
  });

  // ===== 保留词测试 =====

  // 注册 admin 抛通用错误
  it('注册 admin 抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: 'admin',
      password: 'password123',
      nickName: 'Admin',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    // 验证未触发 DB 写入
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册 Admin（大小写变体）抛通用错误：归一化后小写化命中保留词
  it('注册 Admin（大小写变体）抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: 'Admin',
      password: 'password123',
      nickName: 'Admin',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册 root 抛通用错误
  it('注册 root 抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: 'root',
      password: 'password123',
      nickName: 'Root',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册 system 抛通用错误
  it('注册 system 抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: 'system',
      password: 'password123',
      nickName: 'System',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册 客服 抛通用错误：中文保留词
  it('注册 客服 抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '客服',
      password: 'password123',
      nickName: '客服',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册 官方 抛通用错误：中文保留词
  it('注册 官方 抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '官方',
      password: 'password123',
      nickName: '官方',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // ===== 敏感词测试（每分类至少一例，DFA 子串匹配） =====

  // 注册含政治敏感词的用户名抛通用错误
  it('注册含政治敏感词的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '反华bad',
      password: 'password123',
      nickName: 'pol',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册含辱华词汇的用户名抛通用错误
  it('注册含辱华词汇的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '我是辱华分子',
      password: 'password123',
      nickName: 'pol2',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册含男女对立词汇的用户名抛通用错误
  it('注册含男女对立词汇的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '下头男abc',
      password: 'password123',
      nickName: 'gender',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册含暴恐词汇的用户名抛通用错误
  it('注册含暴恐词汇的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '暴恐xx',
      password: 'password123',
      nickName: 'terror',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册含色情词汇的用户名抛通用错误
  it('注册含色情词汇的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '色情abc',
      password: 'password123',
      nickName: 'porn',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // 注册含辱骂词汇的用户名抛通用错误
  it('注册含辱骂词汇的用户名抛通用错误', async () => {
    const dto: RegisterDTO = {
      username: '傻逼abc',
      password: 'password123',
      nickName: 'insult',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
    }
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });

  // ===== 通用错误消息防枚举验证 =====

  // 保留词命中错误消息不含"保留词"字样（不泄露失败原因）
  it('保留词命中错误消息不含"保留词"字样', async () => {
    const dto: RegisterDTO = {
      username: 'admin',
      password: 'password123',
      nickName: 'Admin',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      const msg = (err as Error).message;
      expect(msg).not.toMatch(/保留词/);
      expect(msg).not.toMatch(/reserved/i);
    }
  });

  // 敏感词命中错误消息不含"敏感词"字样（不泄露失败原因）
  it('敏感词命中错误消息不含"敏感词"字样', async () => {
    const dto: RegisterDTO = {
      username: '反华bad',
      password: 'password123',
      nickName: 'pol',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      const msg = (err as Error).message;
      expect(msg).not.toMatch(/敏感词/);
      expect(msg).not.toMatch(/sensitive/i);
    }
  });

  // ===== 正常注册 =====

  // 注册 foodie2026 成功返回 token
  it('注册 foodie2026 成功返回 token', async () => {
    const dto: RegisterDTO = {
      username: 'foodie2026',
      password: 'password123',
      nickName: 'Foodie',
    };
    const result = await service.register(dto);
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.username).toBe('foodie2026');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  // 注册正常用户名调用 repo.save
  it('注册正常用户名调用 repo.save', async () => {
    const dto: RegisterDTO = {
      username: 'foodie2026',
      password: 'password123',
      nickName: 'Foodie',
    };
    await service.register(dto);
    expect((service as any).appUserEntity.save).toHaveBeenCalledTimes(1);
    // 校验 save 收到的参数包含正确字段
    const savedArg = (service as any).appUserEntity.save.mock.calls[0][0];
    expect(savedArg.username).toBe('foodie2026');
    expect(savedArg.password).not.toBe('password123'); // 必须是 bcrypt 哈希
    expect(savedArg.status).toBe(1);
    expect(savedArg.passwordV).toBe(1);
  });

  // ===== 用户名查重（防枚举：与保留词/敏感词返回相同通用错误） =====

  // 用户名已存在抛相同通用错误（防枚举）
  it('用户名已存在抛相同通用错误（防枚举）', async () => {
    // mock findOneBy 返回已存在的用户
    (service as any).appUserEntity.findOneBy = jest
      .fn()
      .mockResolvedValue({ id: 99, username: 'foodie2026' });

    const dto: RegisterDTO = {
      username: 'foodie2026',
      password: 'password123',
      nickName: 'Foodie',
    };
    try {
      await service.register(dto);
      fail('应抛 CoolCommException');
    } catch (err) {
      expect(err).toBeInstanceOf(CoolCommException);
      // 与保留词/敏感词命中相同的通用错误消息
      expect((err as Error).message).toBe(GENERIC_ERR_MSG);
      // 不泄露"已存在"
      const msg = (err as Error).message;
      expect(msg).not.toMatch(/已存在/);
      expect(msg).not.toMatch(/exist/i);
    }
    // 验证未触发 DB 写入（重复用户名不应再 save）
    expect((service as any).appUserEntity.save).not.toHaveBeenCalled();
  });
});
