import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 家庭邀请码
 */
@Entity('weiji_family_invitation')
export class FamilyInvitationEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '邀请码' })
  code: string;

  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Column({ comment: '创建者ID' })
  creatorId: number;

  @Column({ comment: '过期时间' })
  expiresAt: string;

  @Column({ comment: '是否已使用', default: false })
  used: boolean;
}
