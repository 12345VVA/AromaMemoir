import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 家庭成员
 */
@Entity('weiji_family_member')
@Index('idx_family_user', ['familyId', 'userId'], { unique: true })
export class FamilyMemberEntity extends BaseEntity {
  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '角色 owner/admin/member', default: 'member' })
  role: string;

  @Column({ comment: '加入时间', nullable: true })
  joinedAt: string;
}
