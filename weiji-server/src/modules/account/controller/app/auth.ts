import { Provide, Body, Inject, Post } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolUrlTag,
  CoolTag,
  TagTypes,
} from '@cool-midway/core';
import { AppLoginDTO } from '../../dto/login';
import { RegisterDTO } from '../../dto/register';
import { AppAuthService } from '../../service/auth';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';

/**
 * C端账户认证
 */
@Provide()
@CoolController({ api: [], prefix: '/app/account', description: 'C端账户认证' })
@CoolUrlTag()
export class AppAccountAuthController extends BaseController {
  @Inject()
  appAuthService: AppAuthService;

  @Inject()
  ctx: Context;

  /**
   * 登录
   * @param dto 登录参数
   */
  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Post('/login', { summary: '登录' })
  @Validate()
  async login(@Body() dto: AppLoginDTO) {
    return this.ok(await this.appAuthService.login(dto));
  }

  /**
   * 注册
   * @param dto 注册参数
   */
  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Post('/register', { summary: '注册' })
  @Validate()
  async register(@Body() dto: RegisterDTO) {
    return this.ok(await this.appAuthService.register(dto));
  }

  /**
   * 退出登录
   */
  @Post('/logout', { summary: '退出登录' })
  async logout() {
    await this.appAuthService.logout();
    return this.ok(null);
  }
}
