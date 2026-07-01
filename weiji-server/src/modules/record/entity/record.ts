import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 美食记录
 */
@Entity('weiji_record')
export class RecordEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID', nullable: true })
  userId: number;

  @Column({ comment: '菜品名', length: 100 })
  dishName: string;

  @Column({ comment: '烹饪方式', nullable: true })
  cookingMethod: string;

  @Column({ comment: '评分 1-5', default: 0 })
  rating: number;

  @Column({ comment: '备注', type: 'text', nullable: true })
  note: string;

  @Column({ comment: '营养信息 JSON', type: 'json', nullable: true })
  nutrition: any;

  @Column({ comment: '食材 JSON', type: 'json', nullable: true })
  ingredients: any;

  @Column({ comment: '标签 JSON', type: 'json', nullable: true })
  tags: any;

  @Column({ comment: '餐次 breakfast/lunch/dinner/snack', nullable: true })
  mealType: string;

  @Index()
  @Column({ comment: '记录日期', type: 'date', nullable: true })
  recordDate: string;

  @Column({ comment: '图片URL', nullable: true })
  imageUrl: string;

  @Column({ comment: '美化后图片URL', nullable: true })
  beautifiedUrl: string;

  @Column({ comment: '记录来源 manual/ai', default: 'manual' })
  source: string;

  @Column({ comment: '家庭组ID', nullable: true })
  familyId: number;
}
