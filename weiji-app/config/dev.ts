import { host, value } from "./proxy";

export default {
	// 根地址
	host,

	// 请求地址
	get baseUrl() {
		// #ifdef H5
		return `/${value}`;
		// #endif

		// #ifndef H5
		// 真机调试时 localhost 指向设备自身，需通过 VITE_DEV_HOST 配置开发机局域网 IP
		// 例：VITE_DEV_HOST=http://192.168.1.100:8001
		return import.meta.env.VITE_DEV_HOST || this.host;
		// #endif
	},
};
