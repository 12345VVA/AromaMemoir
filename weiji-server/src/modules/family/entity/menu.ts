import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';
import { transformerJson } from '../../base/entity/base';

/**
 * 周菜单
 */
@Entity('weiji_weekly_menu')
export class WeeklyMenuEntity extends BaseEntity {
  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Column({ comment: '星期几 1-7' })
  dayOfWeek: number;

  @Column({ comment: '餐次 breakfast/lunch/dinner' })
  mealType: string;

  @Column({ comment: '菜谱ID', nullable: true })
  recipeId: number;

  @Column({ comment: '菜谱名快照' })
  recipeName: string;

  @Column({
    comment: '点赞用户ID数组 JSON',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  likes: number[];

  @Column({
    comment: '踩用户ID数组 JSON',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  dislikes: number[];

  @Column({ comment: '乐观锁版本号', default: 1 })
  version: number;
}
