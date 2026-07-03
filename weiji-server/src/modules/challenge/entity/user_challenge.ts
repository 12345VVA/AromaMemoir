import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 用户挑战赛参与记录
 */
@Entity('weiji_app_user_challenge')
@Index('idx_user_challenge', ['userId', 'challengeId'], { unique: true })
export class UserChallengeEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Index()
  @Column({ comment: '挑战ID' })
  challengeId: number;

  @Column({ comment: '进度', default: 0 })
  progress: number;

  @Column({ comment: '是否完成', default: false })
  completed: boolean;

  @Column({ comment: '参与时间' })
  joinedAt: string;

  @Column({ comment: '完成时间', nullable: true })
  completedAt: string;
}
