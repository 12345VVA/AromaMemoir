import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 测试配置：与 vite.config.ts 保持一致的路径别名，仅启用 vue 插件
// （cool-admin 的 @cool-vue/vite-plugin eps/bootstrap 仅用于 dev/build，测试不引入）
function toPath(dir: string) {
	return fileURLToPath(new URL(dir, import.meta.url));
}

export default defineConfig({
	plugins: [vue()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.{test,spec}.ts']
	},
	resolve: {
		alias: {
			'/@': toPath('./src'),
			'/$': toPath('./src/modules'),
			'/$/': toPath('./src/modules/'),
			'/#': toPath('./src/plugins'),
			'/~': toPath('./packages')
		}
	}
});
