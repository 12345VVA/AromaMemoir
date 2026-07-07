import { ALL, Config, Middleware, Init, Inject, InjectClient } from '@midwayjs/core';
import { NextFunction, Context } from '@midwayjs/koa';
import { IMiddleware } from '@midwayjs/core';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import { CoolCommException, CoolUrlTagData, TagTypes } from '@cool-midway/core';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { Utils } from '../../../comm/utils';

/**
 * 用户
 */
@Middleware()
export class UserMiddleware implements IMiddleware<Context, NextFunction> {
  @Config(ALL)
  coolConfig;

  @Inject()
  coolUrlTagData: CoolUrlTagData;

  @Config('module.user.jwt')
  jwtConfig;

  ignoreUrls: string[] = [];

  @Config('koa.globalPrefix')
  prefix;

  @Inject()
  utils: Utils;

  @InjectClient(CachingFactory, 'default')
  midwayCache: MidwayCache;

  @Init()
  async init() {
    this.ignoreUrls = this.coolUrlTagData.byKey(TagTypes.IGNORE_TOKEN, 'app');
  }

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      let { url } = ctx;
      url = url.replace(this.prefix, '').split('?')[0];
      if (_.startsWith(url, '/app/')) {
        // 先判免登录：公共接口（如 eps、字典）未登录也直接放行，
        // 避免对空 token 做 jwt 校验而产生无意义的 WARN 日志
        const isIgnored = this.ignoreUrls.some(pattern =>
          this.utils.matchUrl(pattern, url)
        );
        if (isIgnored) {
          await next();
          return;
        }
        const token = ctx.get('Authorization');
        try {
          const payload: any = jwt.verify(token, this.jwtConfig.secret);
          // 归一化 userId / id 字段，兼容 account 模块（userId）与 user 模块历史 token（id）
          const uid = payload.userId || payload.id;
          ctx.user = { ...payload, userId: uid, id: uid };
          // 密码版本校验：与缓存不一致则视为登录失效（注销/改密码后生效）
          // 仅当 token 携带 passwordVersion 时校验，向后兼容旧 token
          if (payload.passwordVersion != null) {
            const cachedV = await this.midwayCache.get(
              `app:passwordVersion:${uid}`
            );
            if (cachedV != payload.passwordVersion) {
              ctx.user = undefined;
            }
          }
        } catch (error) {
          // verify 失败时确保未登录态
          ctx.logger.warn(
            'user auth middleware jwt verify failed',
            error
          );
          ctx.user = undefined;
        }
        // refresh token 不得作为 access token 使用，清空 ctx.user 让后续走未登录流程
        if (ctx.user && ctx.user.isRefresh) {
          ctx.user = undefined;
        }
        if (!ctx.user) {
          ctx.status = 401;
          throw new CoolCommException('登录失效~');
        }
      }
      await next();
    };
  }
}
