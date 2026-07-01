import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

/**
 * 埋点事件
 */
@Entity('weiji_analytics_event')
export class AnalyticsEventEntity extends BaseEntity {
  @Index()
  @Column({ comment: '事件类型' })
  type: string;

  @Index()
  @Column({ comment: '用户ID', nullable: true })
  userId: number;

  @Column({ comment: '事件载荷 JSON', type: 'json', nullable: true })
  payload: any;

  @Column({ comment: '家庭组ID', nullable: true })
  familyId: number;

  @Column({ comment: 'IP', nullable: true })
  ip: string;

  @Column({ comment: 'User-Agent', nullable: true })
  ua: string;
}
