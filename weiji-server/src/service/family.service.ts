// 家庭组服务
// 集中家庭组相关的查询与权限校验逻辑，避免控制器膨胀
// 采用静态函数实现（与 AuthService 风格一致），后续可平滑迁移为注入式 Service

import { families, family_members } from '../store/db';
import { Family, FamilyMember, UserRole } from '../store/types';

// 通过 userId 查找用户在 family_members 中的成员关系记录
// 一个用户在当前实现下只属于一个家庭组，返回第一条匹配
export async function getUserMembership(userId: string): Promise<FamilyMember | undefined> {
  return family_members.findByField('userId', userId);
}

// 查找用户所属家庭组（未删除）
// 流程：先查 family_members 拿到 familyId，再查 families 并排除已软删除的家庭
// 未加入任何家庭组时返回 null
export async function findUserFamily(userId: string): Promise<Family | null> {
  const membership = await getUserMembership(userId);
  if (!membership) return null;
  const family = await families.findById(membership.familyId);
  if (!family || family.isDeleted) return null;
  return family;
}

// 校验当前用户在家庭组中的角色是否在允许列表内
// roles 传 ['owner','admin'] 表示 owner 或 admin 均可；['owner'] 表示仅 owner
// 未加入家庭组或角色不在列表中均返回 false
export async function requireRole(userId: string, roles: UserRole[]): Promise<boolean> {
  const membership = await getUserMembership(userId);
  if (!membership) return false;
  return roles.includes(membership.role);
}

// 返回本周一日期 YYYY-MM-DD（周日视为上周最后一天，回到本周一）
// 用于 weekly_menu.weekStart 字段
export function getCurrentMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sunday, 1=Monday...
  const diff = day === 0 ? -6 : 1 - day; // 回到本周一
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
