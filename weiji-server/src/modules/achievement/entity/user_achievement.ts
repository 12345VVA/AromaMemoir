import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 用户成就解锁记录
 */
@Entity('weiji_user_achievement')
@Index('idx_user_achievement', ['userId', 'achievementId'], { unique: true })
export class UserAchievementEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Index()
  @Column({ comment: '成就ID' })
  achievementId: number;

  @Column({ comment: '解锁时间' })
  earnedAt: string;
}
