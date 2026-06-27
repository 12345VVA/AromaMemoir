// 娱乐化玩法控制器
// 处理 /api/gamification 下全部娱乐化玩法端点：
//   - GET  /api/gamification/pokedex                   美食图鉴
//   - GET  /api/gamification/personality                食物人格测试
//   - GET  /api/gamification/timemachine                 美食时光机
//   - GET  /api/gamification/blindguess/rounds          盲猜轮次列表（F30 多人协同）
//   - POST /api/gamification/blindguess/round            发起盲猜轮次
//   - GET  /api/gamification/blindguess/round/:id        查看轮次详情
//   - POST /api/gamification/blindguess/round/:id/guess  提交猜测
//   - POST /api/gamification/blindguess/round/:id/reveal 揭晓结果
// 与 controllers/checkin.controller.ts、record.controller.ts 风格保持一致

import type { Context } from 'koa';
import { Controller, Get, Post } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import {
  family_members,
  family_recipes,
  users,
  blindGuessRounds,
} from '../store/db';
import { findByField, uuid } from '../store/helpers';
import {
  aggregatePokedex,
  buildPersonalityReport,
  persistPersonality,
  queryTimemachine,
  scoreBlindGuess,
} from '../store/helpers';
import { trackEvent } from '../store/analytics';
import type {
  PokedexSummary,
  PersonalityReport,
  TimemachineResult,
  BlindGuessRound,
  BlindGuessListItem,
  BlindGuessGuess,
  BlindGuessResult,
  BlindGuessItem,
} from '../store/types';

// JWT 中间件挂载到 ctx.state.user 的用户信息
interface AuthUser {
  userId: string;
  username: string;
}

// 创建盲猜轮次请求体
interface CreateRoundBody {
  familyId?: string;
  roundName?: string;
  recordIds?: string[];
}

// 提交猜测请求体
interface SubmitGuessBody {
  itemId?: string;
  guessAuthorId?: string;
  guessAuthorName?: string;
  guessDishName?: string;
}

// active 状态下脱敏轮次：剔除 items 中的 realAuthorId / realAuthorName 字段
// 返回新对象，不修改原 round（保留数据库中的真实作者信息用于揭晓后计分）
function sanitizeActiveRound(round: BlindGuessRound): object {
  const sanitizedItems = round.items.map((it) => ({
    recordId: it.recordId,
    recipeId: it.recipeId,
    dishName: it.dishName,
    coverUrl: it.coverUrl,
  }));
  return {
    id: round.id,
    familyId: round.familyId,
    roundName: round.roundName,
    creatorId: round.creatorId,
    items: sanitizedItems,
    guesses: round.guesses,
    status: round.status,
    createdAt: round.createdAt,
    revealedAt: round.revealedAt,
  };
}

@Controller('/api/gamification')
export class GamificationController {
  // GET /api/gamification/pokedex
  // 美食图鉴：聚合 pokedexCatalog 与当前用户实际记录
  @Get('/pokedex')
  async pokedex(ctx: Context): Promise<ApiResponse<PokedexSummary>> {
    const { userId } = ctx.state.user as AuthUser;
    trackEvent('pokedex_view', userId);
    return ok(aggregatePokedex(userId));
  }

  // GET /api/gamification/personality
  // 食物人格测试：基于近 30 天记录生成人格报告；available 时持久化到 user_personalities
  @Get('/personality')
  async personality(ctx: Context): Promise<ApiResponse<PersonalityReport>> {
    const { userId } = ctx.state.user as AuthUser;
    const report = buildPersonalityReport(userId);
    trackEvent('personality_view', userId);
    // 可用人格时落库（不阻塞返回）
    persistPersonality(userId, report);
    return ok(report);
  }

  // GET /api/gamification/timemachine
  // 美食时光机：查询往年今日记录
  @Get('/timemachine')
  async timemachine(ctx: Context): Promise<ApiResponse<TimemachineResult>> {
    const { userId } = ctx.state.user as AuthUser;
    return ok(queryTimemachine(userId));
  }

  // GET /api/gamification/blindguess/rounds
  // 盲猜轮次列表：返回当前家庭的所有轮次（按 createdAt 降序）
  // active 状态轮次用 sanitizeActiveRound 脱敏；revealed 状态原样返回
  @Get('/blindguess/rounds')
  async listBlindGuessRounds(ctx: Context): Promise<ApiResponse<BlindGuessListItem[]>> {
    const { userId } = ctx.state.user as AuthUser;
    const familyId = (ctx.query.familyId as string | undefined) || '';

    // 校验必填参数
    if (!familyId) {
      return fail('familyId 不能为空', 400);
    }

    // 校验当前用户是该 family 成员（仅家庭成员可查看列表）
    const membership = family_members.find(
      (m) => m.familyId === familyId && m.userId === userId,
    );
    if (!membership) {
      return fail('当前用户不是该家庭组成员', 403);
    }

    // 过滤 + 按 createdAt 降序；active 脱敏，revealed 原样
    const rounds: BlindGuessListItem[] = blindGuessRounds
      .filter((r) => r.familyId === familyId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r): BlindGuessListItem =>
        r.status === 'active' ? (sanitizeActiveRound(r) as BlindGuessListItem) : r,
      );

    return ok(rounds);
  }

  // POST /api/gamification/blindguess/round
  // 发起盲猜轮次：从家庭菜谱中选若干条记录让其他成员猜作者/菜名
  @Post('/blindguess/round')
  async createBlindGuessRound(ctx: Context): Promise<ApiResponse<BlindGuessRound>> {
    const { userId } = ctx.state.user as AuthUser;
    const body = (ctx.request.body || {}) as CreateRoundBody;

    // 校验必填字段
    if (!body.familyId || !body.roundName || !body.roundName.trim()) {
      return fail('familyId 和 roundName 不能为空', 400);
    }
    if (!Array.isArray(body.recordIds)) {
      return fail('recordIds 必须为数组', 400);
    }
    if (body.recordIds.length < 3 || body.recordIds.length > 10) {
      return fail('recordIds 长度需在 3-10 之间', 400);
    }

    // 校验当前用户是该 family 成员
    const membership = family_members.find(
      (m) => m.familyId === body.familyId && m.userId === userId
    );
    if (!membership) {
      return fail('当前用户不是该家庭组成员', 403);
    }

    // 取出 family_recipes 中 id 在 recordIds 中的菜谱（且未删除）
    const wantedIds = new Set(body.recordIds);
    const pickedRecipes = family_recipes.filter(
      (r) => wantedIds.has(r.id) && !r.isDeleted
    );
    if (pickedRecipes.length === 0) {
      return fail('未找到对应菜谱记录', 404);
    }

    // 组装 BlindGuessItem
    const items: BlindGuessItem[] = pickedRecipes.map((recipe) => {
      const author = findByField(users, 'id', recipe.uploaderId);
      return {
        recordId: recipe.id,
        recipeId: recipe.id,
        dishName: recipe.name,
        coverUrl: recipe.coverUrl,
        realAuthorId: recipe.uploaderId,
        realAuthorName: author?.nickname ?? '',
      };
    });

    const now = new Date().toISOString();
    const round: BlindGuessRound = {
      id: uuid(),
      familyId: body.familyId,
      roundName: body.roundName.trim(),
      creatorId: userId,
      items,
      guesses: [],
      status: 'active',
      createdAt: now,
      revealedAt: null,
    };

    blindGuessRounds.push(round);

    // 埋点：盲猜轮次创建（携带 roundId 与 familyId）
    trackEvent('blindguess_create', userId, { roundId: round.id }, body.familyId);

    // 创建后立即返回，但与 GET 详情一致：active 状态下脱敏 items 中的真实作者信息
    return ok(sanitizeActiveRound(round), '盲猜轮次创建成功');
  }

  // GET /api/gamification/blindguess/round/:id
  // 查看轮次详情：揭晓前对 items 中的真实作者信息脱敏
  @Get('/blindguess/round/:id')
  async getBlindGuessRound(ctx: Context): Promise<ApiResponse<BlindGuessRound | object>> {
    const { userId } = ctx.state.user as AuthUser;
    const roundId = ctx.params.id as string;
    const round = findByField(blindGuessRounds, 'id', roundId);
    if (!round) {
      return fail('轮次不存在', 404);
    }

    // 校验当前用户是该 family 成员（仅家庭成员可查看）
    const membership = family_members.find(
      (m) => m.familyId === round.familyId && m.userId === userId
    );
    if (!membership) {
      return fail('当前用户不是该家庭组成员', 403);
    }

    // active 状态下脱敏 items 中的 realAuthorId / realAuthorName
    if (round.status === 'active') {
      return ok(sanitizeActiveRound(round));
    }

    return ok(round);
  }

  // POST /api/gamification/blindguess/round/:id/guess
  // 提交猜测：当前用户对某 item 提交作者/菜名猜测
  @Post('/blindguess/round/:id/guess')
  async submitGuess(ctx: Context): Promise<ApiResponse<BlindGuessGuess>> {
    const { userId } = ctx.state.user as AuthUser;
    const roundId = ctx.params.id as string;
    const body = (ctx.request.body || {}) as SubmitGuessBody;

    const round = findByField(blindGuessRounds, 'id', roundId);
    if (!round) {
      return fail('轮次不存在', 404);
    }

    // 校验轮次状态
    if (round.status !== 'active') {
      return fail('轮次已揭晓', 400);
    }

    // 校验当前用户是 family 成员
    const membership = family_members.find(
      (m) => m.familyId === round.familyId && m.userId === userId
    );
    if (!membership) {
      return fail('当前用户不是该家庭组成员', 403);
    }

    // 校验 itemId 存在
    if (!body.itemId) {
      return fail('itemId 不能为空', 400);
    }
    const itemExists = round.items.some((it) => it.recordId === body.itemId);
    if (!itemExists) {
      return fail('itemId 不存在于轮次中', 400);
    }

    // 校验用户未对该 itemId 提交过猜测
    const alreadyGuessed = round.guesses.some(
      (g) => g.userId === userId && g.itemId === body.itemId
    );
    if (alreadyGuessed) {
      return fail('已对该题目提交过猜测', 400);
    }

    // 校验必填字段
    if (!body.guessAuthorId || !body.guessDishName) {
      return fail('guessAuthorId 和 guessDishName 不能为空', 400);
    }

    // 查询用户昵称
    const user = findByField(users, 'id', userId);
    // 查询被猜作者昵称（前端可能只传 guessAuthorId，由后端补全昵称）
    let guessAuthorName = body.guessAuthorName || '';
    if (!guessAuthorName) {
      const author = findByField(users, 'id', body.guessAuthorId);
      guessAuthorName = author?.nickname ?? '';
    }

    const now = new Date().toISOString();
    const guess: BlindGuessGuess = {
      userId,
      userNickname: user?.nickname ?? '',
      itemId: body.itemId,
      guessAuthorId: body.guessAuthorId,
      guessAuthorName,
      guessDishName: body.guessDishName,
      correct: false,
      score: 0,
      createdAt: now,
    };

    round.guesses.push(guess);

    // 埋点：提交猜测（携带 itemId 与 round.familyId）
    trackEvent('blindguess_submit', userId, { itemId: body.itemId }, round.familyId);

    return ok(guess, '猜测已提交');
  }

  // POST /api/gamification/blindguess/round/:id/reveal
  // 揭晓结果：仅 creator 可操作；计算排名并更新轮次状态
  @Post('/blindguess/round/:id/reveal')
  async revealRound(ctx: Context): Promise<ApiResponse<BlindGuessResult>> {
    const { userId } = ctx.state.user as AuthUser;
    const roundId = ctx.params.id as string;

    const round = findByField(blindGuessRounds, 'id', roundId);
    if (!round) {
      return fail('轮次不存在', 404);
    }

    // 校验轮次状态
    if (round.status !== 'active') {
      return fail('轮次已揭晓', 400);
    }

    // 校验当前用户是轮次 creator
    if (round.creatorId !== userId) {
      return fail('仅轮次发起人可揭晓结果', 403);
    }

    // 计算得分排名（不修改数据库 status，由控制器负责更新）
    const result = scoreBlindGuess(roundId);
    if (!result) {
      // 兜底，理论上不会走到（前面已校验存在）
      return fail('揭晓失败', 500);
    }

    // 更新轮次状态
    round.status = 'revealed';
    round.revealedAt = new Date().toISOString();

    // 重新计算一次结果以反映最新的 status
    const finalResult = scoreBlindGuess(roundId) || result;

    // 埋点：揭晓结果（携带 round.familyId）
    trackEvent('blindguess_reveal', userId, undefined, round.familyId);

    return ok(finalResult, '揭晓成功');
  }
}
