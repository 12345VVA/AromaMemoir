import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 记录评论
 */
@Entity('weiji_record_comment')
export class RecordCommentEntity extends BaseEntity {
  @Index()
  @Column({ comment: '记录ID' })
  recordId: number;

  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '评论内容', type: 'text' })
  content: string;

  @Column({ comment: '用户昵称 快照', nullable: true })
  nickName: string;

  @Column({ comment: '用户头像 快照', nullable: true })
  avatarUrl: string;
}
