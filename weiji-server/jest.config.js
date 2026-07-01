module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // 仅拾取 test/ 目录下的 *.test.ts（与旧工程 tests/{unit,integration} 结构对应）
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/fixtures'],
  coveragePathIgnorePatterns: ['<rootDir>/test/'],
  // 测试文件用独立 tsconfig，包含 src + test，避开主 tsconfig.json 的 exclude
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.spec.json',
      isolatedModules: true,
    },
  },
};
