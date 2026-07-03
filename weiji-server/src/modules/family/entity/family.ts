import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 家庭组
 */
@Entity('weiji_family')
export class FamilyEntity extends BaseEntity {
  @Column({ comment: '家庭组名称', default: '未命名家庭' })
  name: string;

  @Index()
  @Column({ comment: '创建者ID' })
  ownerId: number;

  @Column({ comment: '邀请码', nullable: true })
  inviteCode: string;

  @Column({ comment: '成员数', default: 1 })
  memberCount: number;

  @Column({ comment: '描述', nullable: true })
  description: string;

  @Column({ comment: '乐观锁版本号', default: 1 })
  version: number;
}
