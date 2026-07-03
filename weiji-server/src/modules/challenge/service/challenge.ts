import { Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChallengeEntity } from '../entity/challenge';
import { UserChallengeEntity } from '../entity/user_challenge';

/**
 * 挑战赛服务
 * 提供挑战列表、参与、进度查询、完成判定能力，供 checkin/record 等业务模块调用
 */
@Provide()
export class ChallengeService extends BaseService {
  @InjectEntityModel(ChallengeEntity)
  challengeEntity: Repository<ChallengeEntity>;

  @InjectEntityModel(UserChallengeEntity)
  userChallengeEntity: Repository<UserChallengeEntity>;

  /**
   * 返回所有 isActive=true 的挑战列表
   */
  async list() {
    return await this.challengeEntity.find({ where: { isActive: true } });
  }

  /**
   * 参与挑战
   * 校验挑战存在且启用，且用户未重复参与
   * @param userId 用户ID
   * @param challengeId 挑战ID
   */
  async join(userId: number, challengeId: number) {
    const challenge = await this.challengeEntity.findOneBy({
      id: challengeId,
    });
    if (!challenge || !challenge.isActive) {
      throw new CoolCommException('挑战不存在或未启用');
    }
    const existing = await this.userChallengeEntity.findOneBy({
      userId,
      challengeId,
    });
    if (existing) {
      throw new CoolCommException('已参与该挑战');
    }
    const joinedAt = new Date().toISOString();
    const record = await this.userChallengeEntity.save({
      userId,
      challengeId,
      progress: 0,
      completed: false,
      joinedAt,
    });
    return record;
  }

  /**
   * 获取用户参与的所有挑战进度
   * 关联 ChallengeEntity 取挑战定义，从 rules.target 解析目标值
   * @param userId 用户ID
   */
  async getProgress(userId: number) {
    const userChallenges = await this.userChallengeEntity.find({
      where: { userId },
    });
    if (userChallenges.length === 0) return [];
    const challengeIds = userChallenges.map(uc => uc.challengeId);
    const challenges = await this.challengeEntity.find({
      where: { id: In(challengeIds) },
    });
    const challengeMap = new Map(challenges.map(c => [c.id, c]));
    return userChallenges.map(uc => {
      const challenge = challengeMap.get(uc.challengeId);
      const target = this.parseTarget(challenge?.rules);
      return {
        challenge,
        progress: uc.progress,
        target,
        completed: uc.completed,
      };
    });
  }

  /**
   * 检查并完成挑战
   * type 对应 ChallengeEntity.type（如 'record_count', 'checkin_streak'）
   * 进度取较大值，不回退；达成目标时标记完成
   * 返回新完成的挑战列表（供调用方做经验发放/Toast 提示）
   * @param userId 用户ID
   * @param type 挑战类型
   * @param value 当前指标值
   */
  async checkAndComplete(
    userId: number,
    type: string,
    value: number
  ): Promise<any[]> {
    // 查找该用户参与中（completed=false）的挑战
    const userChallenges = await this.userChallengeEntity.find({
      where: { userId, completed: false },
    });
    if (userChallenges.length === 0) return [];
    const challengeIds = userChallenges.map(uc => uc.challengeId);
    // 过滤 type 匹配的挑战定义
    const challenges = await this.challengeEntity.find({
      where: { id: In(challengeIds), type },
    });
    if (challenges.length === 0) return [];
    const challengeMap = new Map(challenges.map(c => [c.id, c]));

    const now = new Date().toISOString();
    const newlyCompleted: any[] = [];

    for (const uc of userChallenges) {
      const challenge = challengeMap.get(uc.challengeId);
      if (!challenge) continue;
      const target = this.parseTarget(challenge.rules);

      // 进度取较大值，不回退
      const newProgress = Math.max(uc.progress, value);
      const shouldComplete = target != null && newProgress >= target;

      // 进度无变化且未达成，跳过
      if (newProgress === uc.progress && !shouldComplete) {
        continue;
      }

      uc.progress = newProgress;
      if (shouldComplete) {
        uc.completed = true;
        uc.completedAt = now;
        newlyCompleted.push({
          challenge,
          progress: newProgress,
          target,
          completed: true,
        });
      }
      await this.userChallengeEntity.save(uc);
    }

    return newlyCompleted;
  }

  /**
   * 从 rules 中解析 target 值
   * 兼容 json 列返回字符串或对象的情况
   */
  private parseTarget(rules: any): number | null {
    if (!rules) return null;
    const obj = typeof rules === 'string' ? this.safeParse(rules) : rules;
    if (obj && typeof obj.target === 'number') return obj.target;
    return null;
  }

  private safeParse(s: string): any {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
}
