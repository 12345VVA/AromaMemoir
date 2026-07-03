# Checklist

- [x] pnpm 已全局安装，`pnpm --version` 返回非空版本号（11.9.0）
- [x] `weiji-app/` 下 `pnpm install` 命令退出码为 0
- [x] `weiji-app/node_modules/` 目录已生成
- [x] `weiji-app/node_modules/@dcloudio/vite-plugin-uni` 目录存在
- [x] `weiji-app/node_modules/@dcloudio/uni-cli-shared` 目录存在
- [x] `weiji-app/node_modules/vite` 目录存在
- [x] `weiji-app/node_modules/vue` 目录存在
- [x] `pnpm dev:h5` 能进入 vite 启动阶段（vite v5.4.14 dev server running at / Local: http://localhost:9901/ / ready in 6741ms），不出现 `Cannot find module '@dcloudio/vite-plugin-uni'` 之类的依赖解析错误
- [x] `weiji-app/README.md` 的「依赖安装」小节包含「不要使用 npm install」提示与 `npm install -g pnpm` 安装指引
- [x] `weiji-app/pnpm-lock.yaml` 内容由 pnpm 自动更新（pnpm install 后），未被手动篡改
- [x] `weiji-app/package.json` 仅新增 `cross-env` 依赖并改写 scripts 为 cross-env 形式（修复 Windows 兼容性），其它依赖声明未变
- [x] `weiji-app/pnpm-workspace.yaml` 中 `allowBuilds` 占位符已改为 `true`（解除 pnpm 11 ERR_PNPM_IGNORED_BUILDS 阻塞）
