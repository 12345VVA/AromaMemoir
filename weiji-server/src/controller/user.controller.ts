// 用户控制器
// 处理 /api/user/profile
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - getUserProfile() → GET /api/user/profile

import type { Context } from 'koa';
import { Controller, Get } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import { users, records, family_recipes, user_achievements } from '../store/db';
import { findByField } from '../store/helpers';
import { CheckinService } from '../service/checkin.service';

// 用户档案中的统计数据
interface UserProfileStats {
  recordCount: number;
  recipeCount: number;
  streak: number;
  achievementCount: number;
}

// 用户档案返回结构（不含 password 字段）
interface UserProfile {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  email?: string;
  phone?: string;
  createdAt: string;
  stats: UserProfileStats;
}

@Controller('/api/user')
export class UserController {
  // GET /api/user/profile
  // 返回当前登录用户的基本信息和统计数据
  // 注意：不返回 password 字段
  @Get('/profile')
  async profile(ctx: Context): Promise<ApiResponse<UserProfile>> {
    const userId = ctx.state.user.userId;

    const user = findByField(users, 'id', userId);
    if (!user) {
      // 用户不存在时返回业务错误码 404
      // 注：与 auth.controller 一致，仅设置响应体 code 字段，不改 HTTP 状态码
      // （前端 axios 拦截器依据 res.code 判错，HTTP 200 + body.code=404 可保留可读 message）
      return fail('用户不存在', 404);
    }

    // 统计数据计算
    // recordCount：用户未删除的饮食记录数
    const recordCount = records.filter((r) => r.userId === userId && !r.isDeleted).length;
    // recipeCount：用户上传且未删除的家庭菜谱数
    const recipeCount = family_recipes.filter(
      (r) => r.uploaderId === userId && !r.isDeleted
    ).length;
    // streak：连续打卡天数，复用 checkin service 逻辑
    const streak = CheckinService.calculateStreak(userId);
    // achievementCount：用户已解锁的成就数
    const achievementCount = user_achievements.filter((ua) => ua.userId === userId).length;

    // 组装安全用户对象（剔除 password）
    const profile: UserProfile = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      createdAt: user.createdAt,
      stats: {
        recordCount,
        recipeCount,
        streak,
        achievementCount,
      },
    };
    if (user.email !== undefined) profile.email = user.email;
    if (user.phone !== undefined) profile.phone = user.phone;

    return ok(profile);
  }
}
