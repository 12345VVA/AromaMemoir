import { ModuleConfig } from '@cool-midway/core';

/**
 * 家庭组模块配置
 */
export default () => {
  return {
    // 模块名称
    name: '家庭组',
    // 模块描述
    description: '味记家庭组、成员、邀请、菜谱、菜单、购物、报告',
    // 中间件，全局有效
    globalMiddlewares: [],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 7,
    // app参数配置允许读取的key
    allowKeys: [],
  } as ModuleConfig;
};
