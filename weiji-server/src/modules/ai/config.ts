import { ModuleConfig } from '@cool-midway/core';
import { AiStaticProxyMiddleware } from './middleware/staticProxy';

/**
 * 模块的配置
 */
export default () => {
  return {
    // 模块名称
    name: 'AI 代理',
    // 模块描述
    description: '味记 AI 服务代理，转发 weiji-ai',
    // 中间件，全局有效
    // AiStaticProxyMiddleware 拦截 /app/ai/static/** 流式转发到 weiji-ai：
    // 以中间件而非 controller 路由实现，规避 cool-eps 对 :path(.*) 通配符的误解析
    globalMiddlewares: [AiStaticProxyMiddleware],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 3,
    // app参数配置允许读取的key
    allowKeys: [],
    // AI 服务地址
    url: process.env.AI_SERVICE_URL || 'http://localhost:17802',
  } as ModuleConfig;
};
