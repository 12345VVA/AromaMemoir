import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 打卡记录
 */
@Entity('weiji_checkin')
@Index('idx_user_checkdate', ['userId', 'checkDate'], { unique: true })
export class CheckinEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Index()
  @Column({ comment: '打卡日期 YYYY-MM-DD' })
  checkDate: string;

  @Column({ comment: '连续天数', default: 1 })
  streak: number;

  @Column({ comment: '是否补签', default: false })
  isReplenished: boolean;
}
