// 认证服务
// 提供用户注册、登录、登出能力
// 采用静态方法实现（无需 DI 容器），与 Midway Service 风格保持兼容，后续可平滑迁移为 @Service 注入

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { appConfig } from '../configuration';
import { users } from '../store/db';
import { User } from '../store/types';
import { findByField, insert, uuid } from '../store/helpers';

// 安全用户对象（去除 password 字段）
export type SafeUser = Omit<User, 'password'>;

// 登录返回结构（与前端 client.ts 契约一致：{ token, user: { id, username, nickname } }）
export interface LoginResult {
  token: string;
  user: { id: string; username: string; nickname: string; avatar: string };
}

// 注册返回结构（返回新用户对象，不含 password）
export interface RegisterResult {
  token: string;
  user: SafeUser;
}

// JWT payload 结构
interface JwtPayload {
  userId: string;
  username: string;
}

export class AuthService {
  // 签发 JWT token
  // 注：@types/jsonwebtoken v9 的 SignOptions.expiresIn 为模板字面量类型 StringValue，
  // 不接受普通 string；此处 appConfig.jwt.expiresIn 运行时为 '7d' 等合法值，
  // 通过对象字面量断言为 SignOptions 绕过严格字面量检查
  private static signToken(payload: JwtPayload): string {
    return jwt.sign(payload, appConfig.jwt.secret, {
      expiresIn: appConfig.jwt.expiresIn,
    } as SignOptions);
  }

  // 将 User 转为 SafeUser（剔除 password 字段）
  private static toSafeUser(user: User): SafeUser {
    const safe: SafeUser = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    if (user.email !== undefined) safe.email = user.email;
    if (user.phone !== undefined) safe.phone = user.phone;
    return safe;
  }

  // 注册新用户
  // 校验用户名非空且不重复，密码 bcrypt 哈希后入库，注册成功自动签发 token
  static async register(username: string, password: string, nickname: string): Promise<RegisterResult> {
    // 入参校验
    if (!username || !username.trim()) {
      throw new Error('用户名不能为空');
    }
    if (!password) {
      throw new Error('密码不能为空');
    }
    if (!nickname || !nickname.trim()) {
      throw new Error('昵称不能为空');
    }

    // 用户名查重
    const existed = findByField(users, 'username', username);
    if (existed) {
      throw new Error('用户名已存在');
    }

    // bcrypt 哈希密码
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    // 头像使用 dicebear 占位（按用户名生成，保持确定性）
    const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;

    // 插入新用户，id 使用 uuid 生成
    const newUser = insert(users, {
      id: uuid(),
      username,
      password: passwordHash,
      nickname,
      avatar,
      createdAt: now,
      updatedAt: now,
    });

    const safeUser = AuthService.toSafeUser(newUser);
    // 注册成功后自动签发 token（复用签发逻辑）
    const token = AuthService.signToken({ userId: safeUser.id, username: safeUser.username });
    return { token, user: safeUser };
  }

  // 用户登录
  // 校验账号密码后签发 token，返回 { token, user }
  static async login(username: string, password: string): Promise<LoginResult> {
    const user = findByField(users, 'username', username);
    if (!user) {
      throw new Error('用户名或密码错误');
    }
    // bcrypt 校验密码
    const matched = bcrypt.compareSync(password, user.password);
    if (!matched) {
      throw new Error('用户名或密码错误');
    }
    const token = AuthService.signToken({ userId: user.id, username: user.username });
    return {
      token,
      user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar },
    };
  }

  // 退出登录
  // JWT 无服务端状态，前端清除 token 即可，后端空实现
  static async logout(): Promise<void> {
    // 无需处理
  }
}
