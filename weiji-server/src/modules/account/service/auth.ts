import { Inject, Provide, Config, InjectClient } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { LoginDTO } from '../dto/login';
import { RegisterDTO } from '../dto/register';
import { AppUserEntity } from '../entity/user';
import { Repository } from 'typeorm';
import { InjectEntityModel } from '@midwayjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Context } from '@midwayjs/koa';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';

/**
 * C端认证服务
 */
@Provide()
export class AppAuthService extends BaseService {
  @InjectClient(CachingFactory, 'default')
  midwayCache: MidwayCache;

  @InjectEntityModel(AppUserEntity)
  appUserEntity: Repository<AppUserEntity>;

  @Inject()
  ctx: Context;

  @Config('module.account')
  coolConfig;

  /**
   * 注册
   * 校验用户名不重复，bcrypt 哈希密码后入库，注册成功自动签发 token
   * @param dto 注册参数
   */
  async register(dto: RegisterDTO) {
    const { username, password, nickName } = dto;
    // 用户名查重
    const existed = await this.appUserEntity.findOneBy({ username });
    if (existed) {
      throw new CoolCommException('用户名已存在');
    }
    // bcrypt 哈希密码（10 轮 salt）
    const passwordHash = bcrypt.hashSync(password, 10);
    // 插入新用户
    const user = await this.appUserEntity.save({
      username,
      password: passwordHash,
      nickName: nickName || username,
      avatarUrl: '',
      status: 1,
      passwordV: 1,
    });
    // 签发 token
    const { expire } = this.coolConfig.jwt.token;
    const token = await this.generateToken(user, expire);
    // 缓存 token
    await this.midwayCache.set(`app:token:${user.id}`, token);
    return {
      token,
      user: this.safeUser(user),
    };
  }

  /**
   * 登录
   * 校验账号密码后签发 token，并缓存
   * @param dto 登录参数
   */
  async login(dto: LoginDTO) {
    const { username, password } = dto;
    const user = await this.appUserEntity.findOneBy({ username });
    // 用户不存在 / 状态禁用 / 密码不匹配 均抛同一异常，避免泄露用户是否存在
    if (!user || user.status === 0) {
      throw new CoolCommException('账户或密码不正确');
    }
    const matched = bcrypt.compareSync(password, user.password);
    if (!matched) {
      throw new CoolCommException('账户或密码不正确');
    }
    // 签发 token 并缓存
    const { expire } = this.coolConfig.jwt.token;
    const token = await this.generateToken(user, expire);
    await this.midwayCache.set(`app:token:${user.id}`, token);
    return {
      token,
      user: this.safeUser(user),
    };
  }

  /**
   * 退出登录
   * 清除缓存的 token
   */
  async logout() {
    if (!this.coolConfig.jwt.sso) return;
    const userId = this.ctx.user?.userId;
    if (userId) {
      await this.midwayCache.del(`app:token:${userId}`);
    }
  }

  /**
   * 获取当前用户资料
   * @param userId 用户ID
   */
  async getProfile(userId: number) {
    const user = await this.appUserEntity.findOneBy({ id: userId });
    if (!user) {
      throw new CoolCommException('用户不存在');
    }
    return this.safeUser(user);
  }

  /**
   * 更新用户资料
   * 仅更新提供的字段
   * @param userId 用户ID
   * @param param 昵称、头像
   */
  async updateProfile(
    userId: number,
    param: { nickName?: string; avatarUrl?: string }
  ) {
    const { nickName, avatarUrl } = param;
    const updateData: { nickName?: string; avatarUrl?: string } = {};
    if (nickName !== undefined) updateData.nickName = nickName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (Object.keys(updateData).length > 0) {
      await this.appUserEntity.update(userId, updateData);
    }
    const user = await this.appUserEntity.findOneBy({ id: userId });
    if (!user) {
      throw new CoolCommException('用户不存在');
    }
    return this.safeUser(user);
  }

  /**
   * 生成 token
   * @param user 用户对象
   * @param expire 过期时间（秒）
   */
  private async generateToken(user: AppUserEntity, expire: number) {
    const tokenInfo = {
      isRefresh: false,
      userId: user.id,
      username: user.username,
      passwordVersion: user.passwordV,
      tenantId: user.tenantId,
    };
    return jwt.sign(tokenInfo, this.coolConfig.jwt.secret, {
      expiresIn: expire,
    });
  }

  /**
   * 安全用户对象（剥除 password）
   * @param user 用户对象
   */
  private safeUser(user: AppUserEntity) {
    return {
      id: user.id,
      username: user.username,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createTime: user.createTime,
    };
  }
}
