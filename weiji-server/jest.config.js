module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // isolatedModules: true 让 ts-jest 使用 transpileModule 跳过类型检查，
      // 避免 base.ts 中 `import * as moment from 'moment'` 的 TS2349 类型错误
      // （该写法运行时正常，仅类型层面报错；源码不可改，故测试侧关闭类型检查）
      isolatedModules: true,
      tsconfig: {
        // 测试用 tsconfig，放宽 rootDir 限制
        target: 'es2018',
        module: 'commonjs',
        moduleResolution: 'node',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
      },
    }],
  },
  // 词库文件是 JSON，jest 默认能解析 JSON
  // username-policy.ts 用 __dirname 解析词库路径，jest 下 __dirname 指向 src/modules/account/util/
  // 由于 ts-jest 不输出文件而是内存转换，__dirname 指向 src/ 而非 dist/
  // path.join(__dirname, '../words/xxx.json') 解析为 src/modules/account/words/xxx.json，已存在
};
