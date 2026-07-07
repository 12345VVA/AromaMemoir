/**
 * DFA（确定有限自动机）敏感词检测工具
 * 用于用户名等短文本的敏感词匹配，纯原生实现，不依赖外部库
 */

/** DFA 节点 */
export interface DFANode {
  children: Map<string, DFANode>;
  isEnd: boolean;
  word?: string; // 命中时记录完整词，用于日志
}

/** 创建空 DFA 节点 */
export function createDFANode(): DFANode {
  return { children: new Map(), isEnd: false };
}

/**
 * 构建 DFA 词树
 * 过滤空字符串与纯空白字符串，按 Unicode code point 拆分每个词
 * 每个词末字符节点标记 isEnd 并记录原词
 */
export function buildDFA(words: string[]): DFANode {
  const root = createDFANode();
  for (const word of words) {
    // 过滤空字符串与纯空白字符串
    if (!word || word.trim() === '') continue;
    // 按 code point 拆分，避免代理对被拆开
    const chars = Array.from(word);
    let node = root;
    for (const char of chars) {
      let child = node.children.get(char);
      if (!child) {
        child = createDFANode();
        node.children.set(char, child);
      }
      node = child;
    }
    node.isEnd = true;
    node.word = word;
  }
  return root;
}

/**
 * DFA 匹配（布尔结果）
 * 从 text 的每个起始位置尝试沿 DFA 树下行，任一位置命中任一敏感词即返回 true
 * 空 text 或空 root（无子节点）返回 false
 */
export function matchDFA(text: string, root: DFANode): boolean {
  if (!text || !root || root.children.size === 0) return false;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    let node = root;
    for (let j = i; j < chars.length; j++) {
      const child = node.children.get(chars[j]);
      if (!child) break;
      node = child;
      if (node.isEnd) return true;
    }
  }
  return false;
}

/**
 * DFA 匹配（返回命中详情）
 * 与 matchDFA 逻辑一致，但返回命中的第一个敏感词，便于日志记录
 * 无命中时返回 { hit: false }
 */
export function matchDFADetail(
  text: string,
  root: DFANode
): { hit: boolean; word?: string } {
  if (!text || !root || root.children.size === 0) return { hit: false };
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    let node = root;
    for (let j = i; j < chars.length; j++) {
      const child = node.children.get(chars[j]);
      if (!child) break;
      node = child;
      if (node.isEnd) return { hit: true, word: node.word };
    }
  }
  return { hit: false };
}
