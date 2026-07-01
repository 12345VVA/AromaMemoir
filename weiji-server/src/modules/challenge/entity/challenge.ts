import { BaseEntity } from '../../base/entity/base';
import { Column, Entity } from 'typeorm';

/**
 * 挑战赛
 */
@Entity('weiji_challenge')
export class ChallengeEntity extends BaseEntity {
  @Column({ comment: '挑战名称' })
  name: string;

  @Column({ comment: '描述', nullable: true })
  description: string;

  @Column({ comment: '类型', nullable: true })
  type: string;

  @Column({ comment: '规则 JSON', type: 'json', nullable: true })
  rules: any;

  @Column({ comment: '奖励经验', default: 0 })
  exp: number;

  @Column({ comment: '开始时间', nullable: true })
  startTime: string;

  @Column({ comment: '结束时间', nullable: true })
  endTime: string;

  @Column({ comment: '是否启用', default: true })
  isActive: boolean;
}
