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
	} catch {
		// api.ts 已统一 toast
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
