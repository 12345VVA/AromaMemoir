import {
  normalizeUsername,
  toHalfWidth,
  toSimplified,
  stripSymbols,
} from '../../src/modules/account/util/normalize';
import {
  buildDFA,
  matchDFA,
  matchDFADetail,
  createDFANode,
} from '../../src/modules/account/util/dfa';
import {
  validateUsername,
  isReserved,
  __resetCacheForTest,
} from '../../src/modules/account/util/username-policy';

describe('normalize', () => {
  describe('toHalfWidth', () => {
    it('全角字母转半角：ａｄｍｉｎ → admin', () => {
      expect(toHalfWidth('ａｄｍｉｎ')).toBe('admin');
    });

    it('全角字母数字转半角：ＡＢＣ１２３ → ABC123', () => {
      expect(toHalfWidth('ＡＢＣ１２３')).toBe('ABC123');
    });

    it('全角空格转半角空格：\\u3000 → \\u0020', () => {
      expect(toHalfWidth('\u3000')).toBe('\u0020');
    });
  });

  describe('normalizeUsername 小写化', () => {
    it('Admin 归一化后为 admin（小写化）', () => {
      expect(normalizeUsername('Admin')).toBe('admin');
    });
  });

  describe('toSimplified', () => {
    it('繁体转简体：國華網 → 国华网', () => {
      expect(toSimplified('國華網')).toBe('国华网');
    });

    it('繁体转简体：龍鳳 → 龙凤', () => {
      expect(toSimplified('龍鳳')).toBe('龙凤');
    });
  });

  describe('stripSymbols', () => {
    it('去除星号：a*d*m*i*n → admin', () => {
      expect(stripSymbols('a*d*m*i*n')).toBe('admin');
    });

    it('去除多种符号：a-b_c.d e → abcde', () => {
      expect(stripSymbols('a-b_c.d e')).toBe('abcde');
    });
  });

  describe('normalizeUsername 组合归一化', () => {
    it('全角组合：ａｄｍｉｎ → admin', () => {
      expect(normalizeUsername('ａｄｍｉｎ')).toBe('admin');
    });

    it('大小写混合：AdMiN → admin', () => {
      expect(normalizeUsername('AdMiN')).toBe('admin');
    });

    it('符号插入：a*d*m*i*n → admin', () => {
      expect(normalizeUsername('a*d*m*i*n')).toBe('admin');
    });

    it('繁体：國 → 国', () => {
      expect(normalizeUsername('國')).toBe('国');
    });

    it('首尾空格被去除： Admin  → admin', () => {
      expect(normalizeUsername(' Admin ')).toBe('admin');
    });
  });

  describe('normalizeUsername 空输入', () => {
    it('空字符串归一化为空', () => {
      expect(normalizeUsername('')).toBe('');
    });

    it('纯符号归一化为空', () => {
      expect(normalizeUsername('***')).toBe('');
    });
  });
});

describe('dfa', () => {
  it('空词列表构建的 root 无子节点', () => {
    const root = buildDFA([]);
    expect(root.children.size).toBe(0);
  });

  it('单词构建后能精确命中：admin', () => {
    const root = buildDFA(['admin']);
    expect(matchDFA('admin', root)).toBe(true);
  });

  it('子串命中：myadmin123 包含 admin', () => {
    const root = buildDFA(['admin']);
    expect(matchDFA('myadmin123', root)).toBe(true);
  });

  it('未命中：user 不含 admin', () => {
    const root = buildDFA(['admin']);
    expect(matchDFA('user', root)).toBe(false);
  });

  it('空文本不命中', () => {
    const root = buildDFA(['admin']);
    expect(matchDFA('', root)).toBe(false);
  });

  it('多词构建：admin 与 root 均可命中', () => {
    const root = buildDFA(['admin', 'root']);
    expect(matchDFA('admin', root)).toBe(true);
    expect(matchDFA('root', root)).toBe(true);
  });

  it('matchDFADetail 命中返回命中词：myadmin → { hit: true, word: "admin" }', () => {
    const root = buildDFA(['admin']);
    expect(matchDFADetail('myadmin', root)).toEqual({ hit: true, word: 'admin' });
  });

  it('matchDFADetail 未命中返回 { hit: false }', () => {
    const root = buildDFA(['admin']);
    expect(matchDFADetail('user', root)).toEqual({ hit: false });
  });

  it('中文 DFA 子串命中：我是客服 包含 客服', () => {
    const root = buildDFA(['客服']);
    expect(matchDFA('我是客服', root)).toBe(true);
  });

  it('createDFANode 返回初始节点：children 为空 Map，isEnd 为 false', () => {
    const node = createDFANode();
    expect(node.children.size).toBe(0);
    expect(node.isEnd).toBe(false);
  });
});

describe('username-policy validateUsername', () => {
  beforeEach(() => {
    // 每个用例前重置缓存，确保从词库重新加载
    __resetCacheForTest();
  });

  describe('保留词命中', () => {
    it('admin 为保留词 → ok: false', () => {
      expect(validateUsername('admin')).toEqual({ ok: false });
    });

    it('Admin（大小写变体）→ ok: false', () => {
      expect(validateUsername('Admin')).toEqual({ ok: false });
    });

    it('ADMIN（全大写）→ ok: false', () => {
      expect(validateUsername('ADMIN')).toEqual({ ok: false });
    });

    it('root 为保留词 → ok: false', () => {
      expect(validateUsername('root')).toEqual({ ok: false });
    });

    it('system 为保留词 → ok: false', () => {
      expect(validateUsername('system')).toEqual({ ok: false });
    });

    it('客服（中文保留词）→ ok: false', () => {
      expect(validateUsername('客服')).toEqual({ ok: false });
    });

    it('官方（中文保留词）→ ok: false', () => {
      expect(validateUsername('官方')).toEqual({ ok: false });
    });
  });

  describe('保留词变体绕过', () => {
    it('全角 ａｄｍｉｎ 归一化后为 admin → ok: false', () => {
      expect(validateUsername('ａｄｍｉｎ')).toEqual({ ok: false });
    });

    it('大小写混合 AdMiN 归一化后为 admin → ok: false', () => {
      expect(validateUsername('AdMiN')).toEqual({ ok: false });
    });

    it('符号插入 a*d*m*i*n 归一化后为 admin → ok: false', () => {
      expect(validateUsername('a*d*m*i*n')).toEqual({ ok: false });
    });
  });

  describe('保留词精确匹配（非前缀拦截）', () => {
    it('admin123 实际在保留词列表中 → ok: false', () => {
      // 注意：admin123 在 reserved-words.json 中是保留词，故被拦截
      expect(validateUsername('admin123')).toEqual({ ok: false });
    });

    it('adminxyz 非保留词（精确匹配，不前缀拦截 admin）→ ok: true', () => {
      // 验证保留词检查是精确匹配而非前缀匹配：adminxyz 不在列表中
      expect(validateUsername('adminxyz')).toEqual({ ok: true });
    });

    it('administrator 在保留词列表中 → ok: false', () => {
      expect(validateUsername('administrator')).toEqual({ ok: false });
    });

    it('foodie2026 非保留词 → ok: true', () => {
      expect(validateUsername('foodie2026')).toEqual({ ok: true });
    });

    it('user1 非保留词 → ok: true', () => {
      expect(validateUsername('user1')).toEqual({ ok: true });
    });
  });

  describe('敏感词命中', () => {
    it('反动分子（political，包含"反动"）→ ok: false', () => {
      expect(validateUsername('反动分子')).toEqual({ ok: false });
    });

    it('辱华测试（political，包含"辱华"）→ ok: false', () => {
      expect(validateUsername('辱华测试')).toEqual({ ok: false });
    });

    it('港独（political）→ ok: false', () => {
      expect(validateUsername('港独')).toEqual({ ok: false });
    });

    it('邪教组织（ethnic_religion）→ ok: false', () => {
      expect(validateUsername('邪教组织')).toEqual({ ok: false });
    });

    it('恐怖袭击（violence_terror）→ ok: false', () => {
      expect(validateUsername('恐怖袭击')).toEqual({ ok: false });
    });

    it('色情内容（pornography，包含"色情"）→ ok: false', () => {
      expect(validateUsername('色情内容')).toEqual({ ok: false });
    });

    it('网络赌博（gambling_drug）→ ok: false', () => {
      expect(validateUsername('网络赌博')).toEqual({ ok: false });
    });

    it('田园女权（gender_discrimination）→ ok: false', () => {
      expect(validateUsername('田园女权')).toEqual({ ok: false });
    });

    it('傻逼（insult_defamation）→ ok: false', () => {
      expect(validateUsername('傻逼')).toEqual({ ok: false });
    });

    it('网络诈骗（other_illegal）→ ok: false', () => {
      expect(validateUsername('网络诈骗')).toEqual({ ok: false });
    });
  });

  describe('正常用户名通过', () => {
    it('foodie2026 → ok: true', () => {
      expect(validateUsername('foodie2026')).toEqual({ ok: true });
    });

    it('chefwang → ok: true', () => {
      expect(validateUsername('chefwang')).toEqual({ ok: true });
    });

    it('mike → ok: true', () => {
      expect(validateUsername('mike')).toEqual({ ok: true });
    });
  });

  describe('边界', () => {
    it('空字符串 → ok: false', () => {
      expect(validateUsername('')).toEqual({ ok: false });
    });

    it('null → ok: false', () => {
      expect(validateUsername(null as any)).toEqual({ ok: false });
    });

    it('undefined → ok: false', () => {
      expect(validateUsername(undefined as any)).toEqual({ ok: false });
    });

    it('纯符号（归一化后为空）→ ok: false', () => {
      expect(validateUsername('***')).toEqual({ ok: false });
    });
  });
});

describe('username-policy isReserved', () => {
  beforeEach(() => {
    // 每个用例前重置缓存，确保从词库重新加载
    __resetCacheForTest();
  });

  it('admin 为保留词 → true', () => {
    expect(isReserved('admin')).toBe(true);
  });

  it('Admin（大小写变体）→ true', () => {
    expect(isReserved('Admin')).toBe(true);
  });

  it('foodie2026 非保留词 → false', () => {
    expect(isReserved('foodie2026')).toBe(false);
  });

  it('空字符串 → false', () => {
    expect(isReserved('')).toBe(false);
  });

  it('null → false', () => {
    expect(isReserved(null as any)).toBe(false);
  });
});

describe('username-policy 降级', () => {
  let readFileSyncSpy: jest.SpyInstance;
  // 降级测试需要动态 require 以确保 jest.spyOn 生效：
  // username-policy.ts 的 fs 命名空间在 import 时已快照 readFileSync 引用，
  // 必须先 resetModules + spyOn 再 require，才能让 spy 进入新的命名空间快照
  let validate: (username: string) => { ok: boolean };

  beforeEach(() => {
    __resetCacheForTest();
    jest.resetModules();
  });

  afterEach(() => {
    if (readFileSyncSpy) {
      readFileSyncSpy.mockRestore();
      readFileSyncSpy = undefined as any;
    }
    __resetCacheForTest();
    jest.resetModules();
  });

  it('词库文件缺失时保留词降级为 admin/root/system', () => {
    const fs = require('fs');
    readFileSyncSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => {
        throw new Error('ENOENT: file not found');
      });
    const mod = require('../../src/modules/account/util/username-policy');
    validate = mod.validateUsername;
    mod.__resetCacheForTest();

    // admin/root/system 仍被拦截（降级保留词）
    expect(validate('admin')).toEqual({ ok: false });
    expect(validate('root')).toEqual({ ok: false });
    expect(validate('system')).toEqual({ ok: false });

    // 其他保留词（如 official）不再被拦截（降级后不在最小集合中）
    expect(validate('official')).toEqual({ ok: true });

    // 非保留词正常通过
    expect(validate('foodie2026')).toEqual({ ok: true });
  });

  it('词库文件缺失时敏感词 DFA 降级为空', () => {
    const fs = require('fs');
    readFileSyncSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => {
        throw new Error('ENOENT: file not found');
      });
    const mod = require('../../src/modules/account/util/username-policy');
    validate = mod.validateUsername;
    mod.__resetCacheForTest();

    // 敏感词不再被拦截（DFA 降级为空）
    expect(validate('反动分子')).toEqual({ ok: true });
    expect(validate('辱华测试')).toEqual({ ok: true });
  });

  it('JSON 解析失败时同样降级', () => {
    const fs = require('fs');
    readFileSyncSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => {
        return 'not a valid json {{{';
      });
    const mod = require('../../src/modules/account/util/username-policy');
    validate = mod.validateUsername;
    mod.__resetCacheForTest();

    // 降级为最小保留词集合
    expect(validate('admin')).toEqual({ ok: false });
    expect(validate('root')).toEqual({ ok: false });
    expect(validate('official')).toEqual({ ok: true });
  });
});
