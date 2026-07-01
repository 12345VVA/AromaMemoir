<template>
	<cl-page>
		<view class="page-set">
			<template v-if="user.info">
				<cl-text :value="t('账号')" :margin="[0, 0, 20, 20]" block />

				<cl-list :radius="16">
					<cl-list-item :label="t('头像')" :arrow-icon="false">
						<view class="avatar">
							<!-- #ifdef MP-WEIXIN -->
							<button open-type="chooseAvatar" @chooseavatar="uploadAvatar">
								<cl-avatar round :size="88" :src="user.info.avatarUrl" />
							</button>
							<!-- #endif -->

							<!-- #ifndef MP-WEIXIN -->
							<cl-avatar
								round
								:size="88"
								:src="user.info.avatarUrl"
								@tap="uploadAvatar()"
							/>
							<!-- #endif -->
						</view>
					</cl-list-item>
					<cl-list-item :label="t('昵称')" @tap="router.push('/pages/user/edit')">
						<cl-text :value="user.info.nickName" />
					</cl-list-item>
					<cl-list-item :label="t('手机号')" :arrow-icon="false">
						<cl-text :value="user.info.phone" />
					</cl-list-item>
					<cl-list-item label="ID" :arrow-icon="false" :border="false">
						<cl-text :value="user.info.id" />
					</cl-list-item>
				</cl-list>
			</template>

			<cl-text :value="t('关于')" :margin="[30, 0, 20, 20]" block />

			<cl-list :radius="16">
				<cl-list-item
					:label="`${t('关于')} ${app.info.name}`"
					@tap="router.push('/pages/user/about')"
				/>

				<cl-list-item
					:label="t('用户协议')"
					@tap="
						router.push({
							path: '/pages/user/doc',
							query: {
								key: 'userAgreement',
								title: t('用户协议'),
							},
						})
					"
				/>
				<cl-list-item
					:label="t('隐私政策')"
					@tap="
						router.push({
							path: '/pages/user/doc',
							query: {
								key: 'privacyPolicy',
								title: t('隐私政策'),
							},
						})
					"
				/>
			</cl-list>

			<cl-list :radius="16">
				<cl-list-item :label="t('切换账号')" @tap="switchAccount" />
				<cl-list-item :label="t('退出登录')" :arrow-icon="false" @tap="handleLogout">
					<cl-icon :size="36" name="exit" />
				</cl-list-item>
			</cl-list>
		</view>
	</cl-page>
</template>

<script lang="ts" setup>
import { onReady } from "@dcloudio/uni-app";
import { useApp, useCool, useStore } from "/@/cool";
import { useUi } from "/$/cool-ui";
import { useI18n } from "vue-i18n";
import { api } from "/@/utils/api";

const { router } = useCool();
const { user } = useStore();
const ui = useUi();
const app = useApp();
const { t } = useI18n();

// 上传头像（对接 C 端 /app/user/profile，avatar 字段）
function uploadAvatar(e?: { detail: { avatarUrl: string } }) {
	function next(path: string) {
		api.updateProfile({ avatar: path } as any)
			.then(() => {
				ui.showToast(t("头像更新成功"));
				user.set({
					...user.info,
					avatarUrl: path,
					avatar: path,
				});
			})
			.catch((err: any) => {
				ui.showToast(err?.message || t("更新失败"));
			});
	}

	if (e) {
		next(e.detail.avatarUrl);
	} else {
		uni.chooseImage({
			count: 1,
			success(res) {
				// @ts-ignore
				next(res.tempFiles[0].path);
			},
		});
	}
}

// 拉取用户信息（对接 C 端 /app/user/profile，并桥接字段到 cool store）
async function loadProfile() {
	try {
		const data: any = await api.getUserProfile();
		if (data) {
			user.set({
				...user.info,
				...data,
				nickName: data.nickName || data.nickname || user.info?.nickName,
				avatarUrl: data.avatarUrl || data.avatar || user.info?.avatarUrl,
			});
		}
	} catch {
		// 静默
	}
}

// 切换账号
function switchAccount() {
	router.push("/pages/user/login");
}

// 退出登录（调用后端 logout 并清理本地）
async function handleLogout() {
	uni.showModal({
		title: t("退出登录"),
		content: t("确定要退出登录吗？"),
		confirmColor: "#FF6B35",
		success: async (res) => {
			if (!res.confirm) return;
			await api.logout();
			uni.showToast({ title: t("已退出"), icon: "success" });
			setTimeout(() => {
				uni.reLaunch({ url: "/pages/user/login" });
			}, 400);
		},
	});
}

onReady(() => {
	loadProfile();
});
</script>

<style lang="scss" scoped>
.page-set {
	padding: 20rpx 24rpx;

	.avatar {
		padding: 10rpx 0;
		height: 88rpx;

		button {
			padding: 0;
			margin: 0;
			line-height: normal;
			background-color: transparent;

			&::after {
				border: 0;
			}
		}
	}
}
</style>
