const proxy = {
	"/dev/": {
		target: "http://localhost:8001",
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/dev/, ""),
	},

	// app 端接口直连代理（cool-admin-midway /app/**）
	"/app": {
		target: "http://localhost:8001",
		changeOrigin: true,
	},

	// admin 端接口直连代理（cool-admin-midway /admin/**）
	"/admin": {
		target: "http://localhost:8001",
		changeOrigin: true,
	},

	// open 端公开接口代理（cool-admin-midway /open/**，如 /open/health）
	"/open": {
		target: "http://localhost:8001",
		changeOrigin: true,
	},

	"/prod/": {
		target: "https://show.cool-admin.com",
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/prod/, "/api"),
	},
};

const value = "dev";
const host = proxy[`/${value}/`]?.target;

export { proxy, host, value };
