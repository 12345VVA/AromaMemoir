import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 记录点赞
 */
@Entity('weiji_record_like')
@Index('idx_record_user', ['recordId', 'userId'], { unique: true })
export class RecordLikeEntity extends BaseEntity {
  @Index()
  @Column({ comment: '记录ID' })
  recordId: number;

  @Index()
  @Column({ comment: '用户ID' })
  userId: number;
}
