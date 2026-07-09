import { Provide, Inject, Get, Post, Param, Body } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { GamificationService } from '../../service/gamification';

/**
 * C端趣味玩法
 * 美食图鉴 / 食物人格 / 时光机 / 家庭盲猜
 */
@Provide()
@CoolController({ api: [], prefix: '/app/gamification', description: 'C端趣味玩法' })
export class AppGamificationController extends BaseController {
  @Inject()
  gamificationService: GamificationService;

  @Inject()
  ctx: Context;

  /**
   * 美食图鉴：聚合静态目录与当前用户实际记录
   */
  @Get('/pokedex', { summary: '美食图鉴' })
  async pokedex() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.gamificationService.pokedex(userId));
  }

  /**
   * 食物人格测试：基于近 30 天记录生成人格报告
   */
  @Get('/personality', { summary: '食物人格测试' })
  async personality() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.gamificationService.personality(userId));
  }

  /**
   * 美食时光机：查询往年今日记录
   */
  @Get('/timemachine', { summary: '美食时光机' })
  async timemachine() {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.gamificationService.timemachine(userId));
  }

  /**
   * 发起盲猜轮次
   * body: { familyId, roundName, recordIds[3-10] } 或 { familyId, mode: chef|rating|date, roundName? }
   */
  @Post('/blindguess/round', { summary: '发起盲猜轮次' })
  async createRound(@Body() body) {
    const userId = this.ctx.user?.userId;
    if (body && body.mode) {
      return this.ok(
        await this.gamificationService.createBlindGuessRound(userId, body)
      );
    }
    return this.ok(await this.gamificationService.createRound(userId, body));
  }

  /**
   * 查看轮次详情（active 状态脱敏真实作者）
   */
  @Get('/blindguess/round/:id', { summary: '查看盲猜轮次详情' })
  async getRound(@Param('id') id) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.gamificationService.getRound(userId, id));
  }

  /**
   * 提交猜测
   * 传统轮次 body: { itemId, guessAuthorId, guessAuthorName?, guessDishName }
   * mode 轮次 body: { itemId, guessAnswer }
   */
  @Post('/blindguess/round/:id/guess', { summary: '提交猜测' })
  async guess(@Param('id') id, @Body() body) {
    const userId = this.ctx.user?.userId;
    if (body && body.guessAnswer != null) {
      return this.ok(
        await this.gamificationService.guessBlindGuess(userId, id, body)
      );
    }
    return this.ok(await this.gamificationService.guess(userId, id, body));
  }

  /**
   * 揭晓结果（仅轮次 creator 可操作）
   */
  @Post('/blindguess/round/:id/reveal', { summary: '揭晓盲猜结果' })
  async reveal(@Param('id') id) {
    const userId = this.ctx.user?.userId;
    return this.ok(await this.gamificationService.reveal(userId, id));
  }
}
