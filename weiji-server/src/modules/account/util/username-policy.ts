/**
 * 用户名校验策略
 * 串联 normalizeUsername → 保留词精确匹配 → 敏感词 DFA 子串匹配
 * 词库懒加载并单例缓存，文件缺失时降级处理，不阻塞服务启动
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeUsername } from './normalize';
import { buildDFA, matchDFA, DFANode } from './dfa';

// 词库文件路径（util/ 与 words/ 为兄弟目录）
const RESERVED_WORDS_PATH = path.join(__dirname, '../words/reserved-words.json');
const SENSITIVE_WORDS_PATH = path.join(__dirname, '../words/sensitive-words.json');

// 降级用的内置最小保留词集合
const FALLBACK_RESERVED = ['admin', 'root', 'system'];

// 模块级缓存（懒加载，单例）
let reservedSet: Set<string> | null = null;
let dfaRoot: DFANode | null = null;

/**
 * 加载保留词集合
 * 读取 reserved-words.json，words 数组小写化后写入 Set
 * 文件缺失或解析失败时降级为 FALLBACK_RESERVED，并记录错误日志
 */
function loadReservedSet(): Set<string> {
  try {
    const raw = fs.readFileSync(RESERVED_WORDS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const words: unknown = (data as { words?: unknown }).words;
    if (!Array.isArray(words)) {
      throw new Error('reserved-words.json 字段 words 不是数组');
    }
    const set = new Set<string>();
    for (const w of words) {
      if (typeof w === 'string' && w.length > 0) {
        set.add(w.toLowerCase());
      }
    }
    return set;
  } catch (err) {
    console.error(
      `[username-policy] 加载保留词库失败 path=${RESERVED_WORDS_PATH} reason=${(err as Error)?.message ?? err}`
    );
    return new Set(FALLBACK_RESERVED.map((w) => w.toLowerCase()));
  }
}

/**
 * 加载敏感词 DFA
 * 读取 sensitive-words.json，合并所有分类的 words 数组后构建 DFA
 * 文件缺失或解析失败时降级为空词树，并记录错误日志
 */
function loadDFARoot(): DFANode {
  try {
    const raw = fs.readFileSync(SENSITIVE_WORDS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const categories: unknown = (data as { categories?: unknown }).categories;
    if (!categories || typeof categories !== 'object') {
      throw new Error('sensitive-words.json 字段 categories 不是对象');
    }
    const allWords: string[] = [];
    for (const key of Object.keys(categories as Record<string, unknown>)) {
      // 忽略 _ 前缀字段与 comment 字段
      if (key.startsWith('_')) continue;
      const category = (categories as Record<string, unknown>)[key];
      if (!category || typeof category !== 'object') continue;
      const words = (category as { words?: unknown }).words;
      if (!Array.isArray(words)) continue;
      for (const w of words) {
        if (typeof w === 'string' && w.length > 0) {
          allWords.push(w);
        }
      }
    }
    return buildDFA(allWords);
  } catch (err) {
    console.error(
      `[username-policy] 加载敏感词库失败 path=${SENSITIVE_WORDS_PATH} reason=${(err as Error)?.message ?? err}`
    );
    return buildDFA([]);
  }
}

/**
 * 懒加载词库并缓存
 * 已加载则直接返回，首次调用时加载两个词库
 */
function ensureLoaded(): void {
  if (reservedSet && dfaRoot) return;
  reservedSet = loadReservedSet();
  dfaRoot = loadDFARoot();
}

/** 校验结果（仅含 ok 字段，不区分失败原因以防枚举） */
export interface UsernameValidationResult {
  ok: boolean;
}

/**
 * 主校验函数
 * 顺序：归一化 → 保留词精确匹配 → 敏感词 DFA 子串匹配
 * 任一失败返回 { ok: false }，全部通过返回 { ok: true }
 * 空/null/undefined 输入或归一化后为空均返回 { ok: false }
 */
export function validateUsername(username: string): UsernameValidationResult {
  // 边界处理：空字符串 / null / undefined
  if (typeof username !== 'string' || username.length === 0) {
    return { ok: false };
  }
  // step 1: 归一化
  const normalized = normalizeUsername(username);
  if (normalized.length === 0) {
    return { ok: false };
  }
  ensureLoaded();
  // step 2: 保留词精确匹配 O(1)
  if (reservedSet!.has(normalized)) {
    return { ok: false };
  }
  // step 3: 敏感词 DFA 子串匹配
  if (matchDFA(normalized, dfaRoot!)) {
    return { ok: false };
  }
  return { ok: true };
}

/**
 * 仅判断保留词（供前端逻辑参考，不暴露敏感词检测）
 * 归一化后做 Set 精确匹配
 */
export function isReserved(username: string): boolean {
  if (typeof username !== 'string' || username.length === 0) {
    return false;
  }
  const normalized = normalizeUsername(username);
  if (normalized.length === 0) {
    return false;
  }
  ensureLoaded();
  return reservedSet!.has(normalized);
}

/**
 * 供测试用：重置模块级缓存，强制下次调用重新加载词库
 * 仅在测试环境使用
 */
export function __resetCacheForTest(): void {
  reservedSet = null;
  dfaRoot = null;
}
