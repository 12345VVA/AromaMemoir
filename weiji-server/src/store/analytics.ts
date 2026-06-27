// 全玩法埋点体系（F27-F30 行为追踪）
// 提供轻量级内存事件存储：trackEvent 写入、queryEvents 按类型查询。
// 与 db.ts / helpers.ts 解耦：独立数组 + 独立 uuid 生成，避免循环依赖。

import crypto from 'crypto';

// 埋点事件实体
export interface AnalyticsEvent {
  id: string;
  type: string;                 // 事件类型，如 pokedex_view / blindguess_create
  userId: string;
  familyId?: string;            // 家庭维度的玩法事件携带
  payload?: Record<string, any>; // 附加业务字段
  createdAt: string;
}

// 内存事件表（运行时由各玩法端点上报）
export const analytics_events: AnalyticsEvent[] = [];

// 生成 UUID（与 helpers.uuid 等价，此处独立实现避免循环依赖）
function uuid(): string {
  return crypto.randomUUID();
}

// 上报事件：push 到内存数组，不抛错、不阻塞调用方
export function trackEvent(
  type: string,
  userId: string,
  payload?: Record<string, any>,
  familyId?: string,
): void {
  const event: AnalyticsEvent = {
    id: uuid(),
    type,
    userId,
    familyId,
    payload,
    createdAt: new Date().toISOString(),
  };
  analytics_events.push(event);
}

// 查询事件：按 type 过滤，未传 type 时返回全部
export function queryEvents(type?: string): AnalyticsEvent[] {
  if (!type) return analytics_events;
  return analytics_events.filter((e) => e.type === type);
}
