import { ModuleConfig } from '@cool-midway/core';

/**
 * 模块的配置
 */
export default () => {
  return {
    // 模块名称
    name: '成就系统',
    // 模块描述
    description: '味记徽章、等级、经验',
    // 中间件，全局有效
    globalMiddlewares: [],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 6,
    // app参数配置允许读取的key
    allowKeys: [],
  } as ModuleConfig;
};
