// 挑战控制器
// 处理 /api/challenge/list
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - getChallenges() → GET /api/challenge/list

import type { Context } from 'koa';
import { Controller, Get } from '../common/decorators';
import { ok, type ApiResponse } from '../common/response';
import { challenges } from '../store/db';
import type { Challenge } from '../store/types';

@Controller('/api/challenge')
export class ChallengeController {
  // GET /api/challenge/list
  // 返回所有处于激活状态的挑战列表
  @Get('/list')
  async list(_ctx: Context): Promise<ApiResponse<Challenge[]>> {
    // 过滤出 isActive 为 true 的挑战
    const activeChallenges = await challenges.findAll((c) => c.isActive === true);
    return ok(activeChallenges);
  }
}
