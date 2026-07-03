import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 购物清单项
 */
@Entity('weiji_shopping_item')
export class ShoppingItemEntity extends BaseEntity {
  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Column({ comment: '商品名' })
  name: string;

  @Column({ comment: '分类', nullable: true })
  category: string;

  @Column({ comment: '数量', nullable: true })
  quantity: string;

  @Column({ comment: '勾选状态', default: false })
  checked: boolean;

  @Column({ comment: '勾选人ID', nullable: true })
  checkedBy: number;

  @Column({ comment: '勾选时间', nullable: true })
  checkedAt: string;

  @Column({ comment: '排序', default: 0 })
  sort: number;

  @Column({ comment: '乐观锁版本号', default: 1 })
  version: number;
}
