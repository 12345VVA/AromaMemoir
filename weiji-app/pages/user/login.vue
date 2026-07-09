<template>
	<cl-page background-color="#fff">
		<cl-topbar :border="false" background-color="transparent" />

		<view class="page-login">
			<!-- Logo -->
			<view class="logo">
				<view class="logo-icon">🍜</view>
				<text class="title">{{ isRegister ? "注册味记" : "欢迎回来" }}</text>
				<text class="subtitle">{{
					isRegister ? "创建账号，开启美食之旅" : "登录味记，记录美食时光"
				}}</text>
			</view>

			<view class="container">
				<cl-form label-position="top">
					<cl-form-item :label="t('昵称')" v-if="isRegister">
						<cl-input
							v-model="form.nickName"
							:height="90"
							:border-radius="16"
							:placeholder="t('请输入昵称')"
						/>
					</cl-form-item>

					<cl-form-item :label="t('用户名')">
					<cl-input
						v-model="form.username"
						:height="90"
						:border-radius="16"
						:placeholder="t('请输入用户名')"
					/>
				</cl-form-item>

				<cl-text
					v-if="isRegister"
					:size="22"
					color="info"
					:margin="[0, 0, 12, 0]"
					:value="t('用户名不可使用 admin、root 等系统保留词')"
				/>

				<cl-form-item :label="t('密码')">
					<cl-input
						v-model="form.password"
						password
						:height="90"
						:border-radius="16"
						:placeholder="t('请输入密码')"
						@confirm="handleSubmit"
					/>
					<cl-text
						v-if="isRegister"
						:size="22"
						color="info"
						:margin="[12, 0, 0, 0]"
						:value="t('至少 8 字符，需含字母与数字')"
					/>
				</cl-form-item>
				</cl-form>

				<cl-button
					custom
					type="primary"
					:height="96"
					:font-size="32"
					:loading="loading"
					:disabled="loading"
					@tap="handleSubmit"
				>
					{{ isRegister ? t("注册") : t("登录") }}
				</cl-button>

				<!-- 演示账号：仅登录模式，点击自动填充 -->
				<view class="demo-account" v-if="!isRegister" @tap="fillDemo">
					<cl-text :size="24" color="info" :value="t('演示账号')" />
					<cl-text :size="24" color="primary" bold :value="'demo / 123456'" />
				</view>

				<view class="switch">
					<cl-text :size="28" color="info" :value="isRegister ? '已有账号？' : '还没有账号？'" />
					<cl-text
						:size="28"
						bold
						color="primary"
						:value="isRegister ? '立即登录' : '立即注册'"
						@tap="toggleMode"
					/>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "/@/utils/api";
import { isReservedUsername } from "/@/utils/reserved-words";

const { t } = useI18n();

const isRegister = ref(false);
const loading = ref(false);

const form = reactive({
	username: "",
	password: "",
	nickName: "",
});

function toggleMode() {
	isRegister.value = !isRegister.value;
}

function fillDemo() {
	form.username = "demo";
	form.password = "123456";
	uni.showToast({ title: t("已填充演示账号"), icon: "none" });
}

function validate(): string | null {
	if (!form.username.trim()) return t("请输入用户名");
	if (!form.password) return t("请输入密码");
	if (isRegister.value) {
		if (!form.nickName.trim()) return t("请输入昵称");
		if (form.password.length < 8) return t("密码至少 8 位");
	}
	return null;
}

async function handleSubmit() {
	// 防重入：密码输入框 @confirm 可绕过按钮 disabled，loading 时直接返回
	if (loading.value) return;

	// 注册模式：本地保留词预校验，命中则提示并阻止提交
	if (isRegister.value) {
		if (isReservedUsername(form.username)) {
			uni.showToast({
				title: t("该用户名不可用，请更换"),
				icon: "none",
			});
			return;
		}
	}
	const err = validate();
	if (err) {
		uni.showToast({ title: err, icon: "none" });
		return;
	}
	loading.value = true;
	try {
		if (isRegister.value) {
			// api.register 返回 { token, user } 并自动写入 cool user store，注册即登录
			await api.register(form.username.trim(), form.password, form.nickName.trim());
			uni.showToast({ title: t("注册成功"), icon: "success" });
			setTimeout(() => {
				uni.switchTab({ url: "/pages/index/home" });
			}, 400);
			return;
		} else {
			// api.login 成功后由 api.ts 内部 syncUserStore 写入 token + user
			await api.login(form.username.trim(), form.password);
			uni.showToast({ title: t("登录成功"), icon: "success" });
			setTimeout(() => {
				uni.switchTab({ url: "/pages/index/home" });
			}, 400);
		}
	} catch (e: any) {
		// api.ts 已统一 toast；兜底未覆盖场景
		if (e?.message) {
			uni.showToast({ title: e.message, icon: 'none' });
		}
	} finally {
		loading.value = false;
	}
}
</script>

<style lang="scss" scoped>
.page-login {
	.logo {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 12%;

		.logo-icon {
			width: 144rpx;
			height: 144rpx;
			border-radius: 32rpx;
			background-color: #ff6b35;
			color: #fff;
			font-size: 72rpx;
			line-height: 144rpx;
			text-align: center;
			margin-bottom: 32rpx;
			box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.3);
		}

		.title {
			font-size: 48rpx;
			font-weight: 700;
			color: #1f1f22;
			margin-bottom: 16rpx;
		}

		.subtitle {
			font-size: 28rpx;
			color: #8a8a8f;
		}
	}

	.container {
		padding: 64rpx 48rpx 48rpx;

		.demo-account {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8rpx;
			margin-top: 40rpx;
			padding: 16rpx 24rpx;
			background-color: #fff5f0;
			border: 1rpx dashed #ffd4c2;
			border-radius: 12rpx;
		}

		.switch {
			text-align: center;
			margin-top: 48rpx;

			:deep(.cl-text) {
				margin-left: 8rpx;
			}
		}
	}
}
</style>
