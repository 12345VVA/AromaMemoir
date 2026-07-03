// 生产 API 地址占位符，部署时请通过 VITE_API_HOST 环境变量配置真实域名
// 例：VITE_API_HOST=https://api.your-domain.com
const DEFAULT_PROD_HOST = "https://api.weiji.example.com";

export default {
	// 根地址（优先读取环境变量，未配置时使用占位符提醒部署时替换）
	host: import.meta.env.VITE_API_HOST || DEFAULT_PROD_HOST,

	// 请求地址
	get baseUrl() {
		// #ifdef H5
		return "/api";
		// #endif

		// #ifndef H5
		return this.host + "/api";
		// #endif
	},
};
