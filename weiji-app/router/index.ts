import { router, useStore } from "/@/cool";

const ignoreToken = [
	"/pages/user/login",
	"/pages/user/doc",
];

router.beforeEach((to, next) => {
	const { user } = useStore();

	if (ignoreToken.includes(to.path)) {
		next();
	} else {
		if (user.token) {
			next();
		} else {
			// 记录用户原本想去的页面，登录成功后回跳
			uni.setStorageSync("loginIntent", to.path);
			router.login({ reLaunch: true });
		}
	}
});
