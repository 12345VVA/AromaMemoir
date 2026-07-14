// weiji-server 本地监听端口（参考 weiji-server/src/config/config.default.ts availablePort(17801)）
const DEV_SERVER = "http://localhost:17801";

// 生产 API 地址占位符，部署时请替换为实际域名
// 注意：此文件被 vite.config.ts（Node 环境）导入，不可使用 import.meta.env
const PROD_API_HOST = "https://api.weiji.example.com";

const proxy = {
	"/dev/": {
		target: DEV_SERVER,
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/dev/, ""),
	},

	// app 端接口直连代理（cool-admin-midway /app/**）
	"/app": {
		target: DEV_SERVER,
		changeOrigin: true,
	},

	// admin 端接口直连代理（cool-admin-midway /admin/**）
	"/admin": {
		target: DEV_SERVER,
		changeOrigin: true,
	},

	// open 端公开接口代理（cool-admin-midway /open/**，如 /open/health）
	"/open": {
		target: DEV_SERVER,
		changeOrigin: true,
	},

	// 后端上传文件静态资源代理（koa 托管 /upload/**，图片存 weiji-server/public/upload）
	"/upload": {
		target: DEV_SERVER,
		changeOrigin: true,
	},

	// AI 生成图片不直接走 /static，而是通过 weiji-server /app/ai/static/* 流式代理到 weiji-ai
	// （见 weiji-server/ai/middleware/staticProxy.ts AiStaticProxyMiddleware），自动被 /app 代理捕获转发。
	// 此处必须注释掉 /static 的代理，否则会导致本地 (如 /static/icon/tabbar/*) 的图片被 Vite 错误地转发到后端
	// "/static": {
	// 	target: DEV_SERVER,
	// 	changeOrigin: true,
	// },

	// H5 生产构建使用 /api 前缀，本地预览/调试时由 vite 代理转发到 weiji-server
	"/api": {
		target: DEV_SERVER,
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/api/, ""),
	},

	"/prod/": {
		target: PROD_API_HOST,
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/prod/, "/api"),
	},
};

const value = "dev";
const host = proxy[`/${value}/`]?.target;

export { proxy, host, value };
