import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 成就定义
 */
@Entity('weiji_achievement')
export class AchievementEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '成就编码', length: 50 })
  code: string;

  @Column({ comment: '成就名称' })
  name: string;

  @Column({ comment: '描述', nullable: true })
  description: string;

  @Column({ comment: '图标', nullable: true })
  icon: string;

  @Column({ comment: '类型 checkin/record/recipe/etc', nullable: true })
  type: string;

  @Column({ comment: '解锁条件 JSON', type: 'json', nullable: true })
  condition: any;

  @Column({ comment: '奖励经验', default: 0 })
  exp: number;

  @Column({ comment: '是否启用', default: true })
  isActive: boolean;
}
