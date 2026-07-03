// vue-demi shim（Vue 3 专用）
// 等价于 vue-demi@0.14.10 在 Vue 3 下的全部导出，但作为项目本地文件，
// 不经 vite/esbuild 依赖预构建，从而 `export * from "vue"` 由浏览器原生 ESM
// 正确转发，避免预构建下 "does not provide an export named '...'" 错误。
// 用途见 vite.config.ts 中 vue-demi 的 alias。
import * as Vue from "vue";

var isVue2 = false;
var isVue3 = true;
var Vue2 = undefined;

function install() {}

export function set(target, key, val) {
	if (Array.isArray(target)) {
		target.length = Math.max(target.length, key);
		target.splice(key, 1, val);
		return val;
	}
	target[key] = val;
	return val;
}

export function del(target, key) {
	if (Array.isArray(target)) {
		target.splice(key, 1);
		return;
	}
	delete target[key];
}

export * from "vue";
export { Vue, Vue2, isVue2, isVue3, install };
