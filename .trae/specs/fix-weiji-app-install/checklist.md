# Checklist

- [ ] pnpm 已全局安装，`pnpm --version` 返回非空版本号
- [ ] `weiji-app/` 下 `pnpm install` 命令退出码为 0
- [ ] `weiji-app/node_modules/` 目录已生成
- [ ] `weiji-app/node_modules/@dcloudio/vite-plugin-uni` 目录存在
- [ ] `weiji-app/node_modules/@dcloudio/uni-cli-shared` 目录存在
- [ ] `weiji-app/node_modules/vite` 目录存在
- [ ] `weiji-app/node_modules/vue` 目录存在
- [ ] `pnpm dev:h5` 能进入 vite 启动阶段，不出现 `Cannot find module '@dcloudio/vite-plugin-uni'` 之类的依赖解析错误
- [ ] `weiji-app/README.md` 的「依赖安装」小节包含「不要使用 npm install」提示与 `npm install -g pnpm` 安装指引
- [ ] `weiji-app/package.json` 与 `weiji-app/pnpm-lock.yaml` 内容未被修改（保持只读）
