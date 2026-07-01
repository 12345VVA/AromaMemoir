import { ModuleConfig } from '@cool-midway/core';

/**
 * 模块的配置
 *
 * 注意：jwt.secret 必须与内置 user 模块的 module.user.jwt.secret 一致，
 * 因为 user 模块的 UserMiddleware 是全局中间件，对所有 /app/* 路由用
 * module.user.jwt.secret 校验 token。account 模块签发的 token 必须能被
 * 该中间件验签，否则 /app/account/logout、/app/user/profile 等受保护端点会 401。
 */
export default () => {
  return {
    // 模块名称
    name: 'C端账户',
    // 模块描述
    description: '味记 App 端用户注册、登录、资料管理',
    // 中间件，全局有效
    globalMiddlewares: [],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 9,
    // app参数配置允许读取的key
    allowKeys: [],
    // jwt 生成解密token的
    jwt: {
      // 单点登录
      sso: false,
      // 必须与 user 模块 jwt.secret 一致，UserMiddleware 才能验签
      secret: 'cae15566-a72b-4bf2-b89a-54fb1391d83fx',
      // token
      token: {
        // 7天过期
        expire: 7 * 24 * 3600,
        // 30天内，如果没操作过就需要重新登录
        refreshExpire: 30 * 24 * 3600,
      },
    },
  } as ModuleConfig;
};
