import { Provide } from '@midwayjs/core';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { ChallengeEntity } from '../entity/challenge';

/**
 * 挑战赛服务
 */
@Provide()
export class ChallengeService extends BaseService {
  @InjectEntityModel(ChallengeEntity)
  challengeEntity: Repository<ChallengeEntity>;

  /**
   * 返回所有 isActive=true 的挑战列表
   */
  async list() {
    return await this.challengeEntity.find({ where: { isActive: true } });
  }
}
