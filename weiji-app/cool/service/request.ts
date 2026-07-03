import { useStore } from "../store";
import { router } from "../router";
import { isDev, config } from "../../config";
import { storage } from "../utils";
import { getLocale, t } from "/@/locale";

// 请求队列
let requests: any[] = [];

// Token 是否刷新中
let isRefreshing = false;

export default function request(options: any) {
	const { user } = useStore();

	// 标识
	let Authorization = user.token || "";

	// 忽略标识
	config.ignore.token.forEach((e) => {
		if (options.url.includes(e)) {
			Authorization = "";
		}
	});

	if (isDev) {
		console.log(`[${options.method || "GET"}] ${options.url}`);
	}

	return new Promise((resolve, reject) => {
		// 继续请求
		function next() {
			uni.request({
				...options,

				header: {
					Authorization,
					language: getLocale(),
					...options.header,
				},

				success(res: any) {
					const { code, data, message } = res.data as {
						code: number;
						message: string;
						data: any;
					};

					// 无权限
					if (res.statusCode === 401) {
						if (router.info()?.path == router.pages.login) {
							return reject({ message });
						} else {
							user.logout();
							return reject({ message });
						}
					}

					// 服务异常
					if (res.statusCode === 502) {
						return reject({
							message: t("服务异常"),
						});
					}

					// 未找到
					if (res.statusCode === 404) {
						return reject({
							message: `[404] ${options.url}`,
						});
					}

					// 成功
					if (res.statusCode === 200) {
						switch (code) {
							case 1000:
								resolve(data);
								break;
							default:
								reject({ message, code });
						}
					} else {
						reject({ message: t("服务异常") });
					}
				},

				fail(err: any) {
					reject({ message: err.errMsg });
				},
			});
		}

		// 刷新token处理
		if (!options.url.includes("refreshToken")) {
			if (Authorization) {
				// 判断 token 是否过期
				if (storage.isExpired("token")) {
					// 判断 refreshToken 是否过期
					if (storage.isExpired("refreshToken")) {
						// 退出登录并拒绝，避免 Promise 永久 pending
						user.logout();
						return reject({ message: t("登录已过期") });
					}

					// 是否在刷新中
					if (!isRefreshing) {
						isRefreshing = true;
						user.refreshToken()
							.then((token) => {
								requests.forEach((cb) => cb(token));
								requests = [];
								isRefreshing = false;
							})
							.catch((err) => {
								user.logout();
								// 通知所有排队请求失败并清空队列
								requests.forEach((cb) => cb(null, err));
								requests = [];
								isRefreshing = false;
								reject(err);
							});
					}

					// 排入队列，等待 token 刷新完成后用新 token 重新发起请求
					requests.push((token: string | null, err?: any) => {
						if (err) {
							return reject(err);
						}
						// 重新设置 token
						Authorization = token || "";
						next();
					});
					return;
				}
			}
		}

		next();
	});
}
