# COOL-UNI 项目脚手架

## 简介

[演示、文档地址](https://uni-docs.cool-js.com/)

## 本地启动

### 依赖安装

```bash
pnpm install
```

> **注意**：`vite.config.ts` 中引用的 `@dcloudio/vite-plugin-uni` 不能直接 `npm install`，该依赖由 `@dcloudio/uni-cli-shared` 间接引入（已在 `devDependencies` 中声明）。直接执行 `pnpm install` 即可，无需手动安装该包。

> **⚠️ 不要使用 `npm install`**：项目依赖 `@dcloudio/vite-plugin-uni@3.0.0-3081220230817001`，其 peer 依赖声明为 `vite@^4.0.0`，而项目实际使用 `vite@^5.4.14`。npm 7+ 默认严格校验 peer 依赖，会抛出 `ERESOLVE unable to resolve dependency tree` 错误并终止安装。必须使用 pnpm（pnpm 对 peer 依赖更宽容）。如本机未安装 pnpm，请先执行：
>
> ```bash
> npm install -g pnpm
> ```

如遇依赖安装失败或 lock 文件冲突，可清理后重试：

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 启动 H5 开发服务

```bash
pnpm dev:h5
```

启动后访问 `http://localhost:9900`。

### 环境要求

- Node.js >= 16
- pnpm（推荐）或 npm
- 后端服务 `weiji-server` 需在 `http://localhost:8001` 运行（代理配置见 `config/proxy.ts`）

## 更快

#### 启动快

基于 `vite`，快速的冷启动，不需要等待打包，即时的热模块更新，真正的按需编译。

#### 开发快

新增 `eps` 模式，自动扫描接口，代码智能提示。

<img src="https://uni-docs.cool-js.com/images/service-tip.gif" height="300px" />

#### 对接快

有什么功能是前端一个人做不了？？大不了全干了

👉👉 [管理前端（vue3）开发文档、强大的 CRUD 组件](https://cool-js.com/admin/vue/introduce.html#%E4%BB%A3%E7%A0%81%E4%BB%93%E5%BA%93)

👉👉 [服务端（node、midway）开发文档、一键生成代码](https://cool-js.com/admin/node/introduce.html#%E4%BB%A3%E7%A0%81%E4%BB%93%E5%BA%93)

👉👉 [演示地址](https://show.cool-admin.com) 😁

    <img src="https://vue.cool-admin.com/show/admin.jpg" width="500px" />

## 更强

内置请求、路由、文件上传、组件通信、缓存等方法及 ui 库和 hooks

```html
<script lang="ts" setup>
	import { useCool } from "/@/cool";
	import { useUi } from "/$/cool-ui";

	const { service, router, storage, upload } = useCool();
	const ui = useUi();

	// 请求
	service.test.page().then((res) => {
		consoe.log(res);
	});

	// 跳转
	router.push({
		path: "/pages/goods/info",
		query: {
			id: 1,
		},
	});

	// 全局事件
	ui.showLoading();
	ui.showToast();

	// 储存
	storage.set("token", "a123huis");

	// 文件上传
	uni.chooseImage({
		count: 1,
		sourceType: ["album", "camera"],
		success(res) {
			upload(res.tempFiles[0]).then((url) => {
				console.log(url);
			});
		},
	});
</script>
```

## 更全

#### 细腻的代码

-   `service` 无感刷新，直接调用后端接口

    ```ts
    const { service } = useCool();
    ```

-   提供 `entity` 描述，写 `any` 和不写的都哭了

    ```ts
    const list = ref<Eps.UserInfoEntity[]>([]);
    ```

#### 活跃的社区

-   拥有自己的知识库系统

-   [官方有问必答](https://cool-js.com/help/list.html)

#### 丰富的插件

-   [Ai 智能模块](https://cool-js.com/plugin/detail.html?id=58)

-   [客服聊天模块](https://cool-js.com/plugin/detail.html?id=56)

-   [企业机器人](https://cool-js.com/plugin/detail.html?id=41)、[飞书推送](https://cool-js.com/plugin/detail.html?id=30)

-   [各厂商的支付模块](https://cool-js.com/plugin/detail.html?id=33)

-   [云存储](https://cool-js.com/plugin/detail.html?id=36)

-   [PDF 打印](https://cool-js.com/plugin/detail.html?id=44)

-   [更多](https://cool-js.com/plugin/list.html)
