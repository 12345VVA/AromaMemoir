// 极简 Midway.js 风格装饰器
// 与 @midwayjs/decorator 的 @Controller / @Get / @Post 等 API 一致
// 元数据存储在 Reflect 上，由 bootstrap.ts 扫描后注册到 koa-router

import 'reflect-metadata';

const ROUTES_KEY = Symbol('weiji:routes');
const PREFIX_KEY = Symbol('weiji:prefix');

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface RouteDefinition {
  path: string;
  method: HttpMethod;
  handler: string;
}

// 类装饰器：标记控制器并指定路由前缀（与 Midway @Controller(prefix) 用法一致）
export function Controller(prefix: string = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PREFIX_KEY, prefix, target);
  };
}

// 工厂：创建 HTTP 方法装饰器（与 Midway @Get / @Post 等用法一致）
function createMethodDecorator(method: HttpMethod) {
  return (path: string = ''): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
      const routes: RouteDefinition[] = Reflect.getMetadata(ROUTES_KEY, target.constructor) || [];
      routes.push({ path, method, handler: propertyKey as string });
      Reflect.defineMetadata(ROUTES_KEY, routes, target.constructor);
      return descriptor;
    };
  };
}

export const Get = createMethodDecorator('get');
export const Post = createMethodDecorator('post');
export const Put = createMethodDecorator('put');
export const Patch = createMethodDecorator('patch');
export const Delete = createMethodDecorator('delete');

// 读取控制器前缀
export function getControllerPrefix(target: unknown): string {
  const t = target as Record<string, unknown>;
  return (Reflect.getMetadata(PREFIX_KEY, t) as string) || '';
}

// 读取路由元数据列表
export function getRouteDefinitions(target: unknown): RouteDefinition[] {
  const t = target as Record<string, unknown>;
  return (Reflect.getMetadata(ROUTES_KEY, t) as RouteDefinition[]) || [];
}
