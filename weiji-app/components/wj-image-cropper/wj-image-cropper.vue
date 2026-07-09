<template>
	<view v-if="visible" class="wj-cropper">
		<!-- 顶栏：取消 / 完成 -->
		<view class="crop-header" :style="{ paddingTop: statusBarH + 'px' }" @mousedown.stop @touchstart.stop @wheel.stop>
			<text class="crop-btn cancel" @click="cancel">取消</text>
			<text class="crop-title">裁剪图片</text>
			<text class="crop-btn done" @click="confirm">完成</text>
		</view>

		<!-- 裁剪舞台：接收触摸、鼠标、滚轮，图片/遮罩/框均不拦截事件 (pointer-events:none) -->
		<view
			class="crop-stage"
			ref="stageRef"
			@touchstart.stop.prevent="onTouchStart"
			@touchmove.stop.prevent="onTouchMove"
			@touchend="onTouchEnd"
			@touchcancel="onTouchEnd"
			@mousedown.prevent="onMouseDown"
			@wheel.prevent="onWheel"
		>
			<image
				v-if="imgInfo.path"
				class="crop-img"
				:src="imgInfo.path"
				:style="imgStyle"
				mode="aspectFit"
				draggable="false"
			/>
			<!-- 四周暗角：裁剪框尺寸 + 巨大 box-shadow -->
			<view class="crop-mask" :style="maskStyle"></view>
			<!-- 裁剪框 + 九宫格辅助线 -->
			<view class="crop-frame" :style="frameStyle">
				<view class="grid-line gh gh1"></view>
				<view class="grid-line gh gh2"></view>
				<view class="grid-line gv gv1"></view>
				<view class="grid-line gv gv2"></view>
			</view>
		</view>

		<!-- 比例切换：1:1 / 4:3 / 16:9 -->
		<view class="ratio-bar" @mousedown.stop @touchstart.stop @wheel.stop>
			<text
				v-for="r in RATIO_PRESETS"
				:key="r.label"
				class="ratio-chip"
				:class="{ active: currentRatio === r.value }"
				@click="switchRatio(r.value)"
			>{{ r.label }}</text>
		</view>

		<!-- 底栏：重置 / 缩放- / 缩放+ -->
		<view class="crop-footer" @mousedown.stop @touchstart.stop @wheel.stop>
			<text class="foot-btn" @click="reset">重置</text>
			<view class="zoom-row">
				<text class="zoom-btn" @click="zoomBy(-0.15)">－</text>
				<text class="zoom-val">{{ Math.round(transform.scale * 100) }}%</text>
				<text class="zoom-btn" @click="zoomBy(0.15)">＋</text>
			</view>
			<text class="foot-btn" @click="confirm" style="color: var(--wj-primary, #ff6b35); font-weight:600;">下一步</text>
		</view>

		<!-- 离屏绘制 canvas：按裁剪区域重绘并导出压缩结果（移出视口，不可 display:none） -->
		<canvas
			canvas-id="wjCropper"
			class="crop-canvas"
			:style="{ width: destW + 'px', height: destH + 'px' }"
		></canvas>
	</view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, getCurrentInstance, onMounted, onUnmounted } from "vue";

/**
 * 图片裁剪 + 压缩组件（自写，零外部依赖）
 *
 * 交互模型（类微信头像裁剪）：
 *   - 裁剪框固定居中，不支持拖拽缩放裁剪框（保持简单、稳定）；
 *   - 图片支持：单指/鼠标拖拽平移、双指 pinch/鼠标滚轮缩放、底栏 +/- 按钮缩放；
 *   - 拖拽边界：保证图片边缘始终覆盖裁剪框，避免裁出空白；
 *   - 缩放范围：0.5 ~ 3 倍，且不小于"刚好盖满裁剪框"的最小缩放。
 * 导出：用老 Canvas API（createCanvasContext + canvasToTempFilePath）按裁剪区域重绘，
 *      通过 destWidth/destHeight + quality 控制产物体积。
 * 跨端：
 *   - 移动端：touch 事件（双指 pinch + 单指平移）；
 *   - PC/H5：鼠标拖拽 + 滚轮缩放（全部绑定到 .crop-stage 元素，不绑 document/window，
 *            组件卸载时 DOM 销毁自动清理事件，避免 preventDefault 残留阻塞页面滚动）；
 *   - 两端均提供 +/- 按钮作为兜底。
 */
const props = withDefaults(
	defineProps<{
		src: string;
		visible: boolean;
		/** 输出最长边像素，默认 1280 */
		maxEdge?: number;
		/** JPEG 质量 0-1，默认 0.8 */
		quality?: number;
		/** 裁剪框 宽:高 初始值，默认 4:3（食物最常用）；用户可在底栏切换 1:1 / 4:3 / 16:9 */
		ratio?: number;
	}>(),
	{ maxEdge: 1280, quality: 0.8, ratio: 4 / 3 }
);

const emit = defineEmits<{
	(e: "update:visible", v: boolean): void;
	(e: "confirm", tempFilePath: string): void;
	(e: "cancel"): void;
}>();

// 组件实例，用作 createCanvasContext / canvasToTempFilePath 的 scope（自定义组件内必需）
const instance = getCurrentInstance();
const scope: any = instance && instance.proxy;

// 裁剪舞台 DOM 引用（H5 下用于绑定 mousemove/mouseup 到元素本身，避免绑 document）
const stageRef = ref<HTMLElement | null>(null);

// 状态栏高度（顶栏留出）
const statusBarH = ref(0);
// 舞台尺寸（屏幕可视区 px）
const stageW = ref(0);
const stageH = ref(0);

// 原图信息
const imgInfo = reactive({ w: 0, h: 0, path: "" });
// 图片 aspectFit 到舞台后的基础显示尺寸（不含用户缩放）
const base = reactive({ w: 0, h: 0 });
// 用户变换：x/y 为图片中心相对舞台中心的偏移，scale 为额外缩放
const transform = reactive({ x: 0, y: 0, scale: 1 });
// 最小缩放：图片必须盖满裁剪框，防止裁出空白（由 fitImage 计算）
const minScale = ref(1);

// 裁剪框尺寸（舞台 px）
const cropW = ref(0);
const cropH = ref(0);
// 可选裁剪比例（宽:高）。默认 4:3（食物最常用），用户可在底栏切换。
const RATIO_PRESETS = [
	{ label: "1:1", value: 1 },
	{ label: "4:3", value: 4 / 3 },
	{ label: "16:9", value: 16 / 9 },
];
const currentRatio = ref(props.ratio);
// 离屏 canvas 输出尺寸（px）
const destW = ref(1);
const destH = ref(1);

// 图片显示样式：基础宽高 + 居中 + 用户 translate/scale
const imgStyle = computed(() => ({
	width: base.w + "px",
	height: base.h + "px",
	left: stageW.value / 2 - base.w / 2 + "px",
	top: stageH.value / 2 - base.h / 2 + "px",
	transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
}));

// 裁剪框居中（给底栏留出 100px 空间避免遮挡）
const footerH = 100;
const frameStyle = computed(() => {
	const availH = stageH.value - footerH;
	return {
		width: cropW.value + "px",
		height: cropH.value + "px",
		left: (stageW.value - cropW.value) / 2 + "px",
		top: Math.max(80, (availH - cropH.value) / 2) + "px",
	};
});

// 裁剪框在舞台中的实际位置（px，用于边界 clamp 与遮罩）
const cropLeft = computed(() => (stageW.value - cropW.value) / 2);
const cropTop = computed(() => {
	const availH = stageH.value - footerH;
	return Math.max(80, (availH - cropH.value) / 2);
});

// 四周遮罩
const maskStyle = computed(() => ({
	width: cropW.value + "px",
	height: cropH.value + "px",
	left: cropLeft.value + "px",
	top: cropTop.value + "px",
	boxShadow: `0 0 0 ${Math.max(stageW.value, stageH.value) * 2}px rgba(0,0,0,0.55)`,
}));

// ========== 事件状态 ==========
// touch
let lastPt: { x: number; y: number } | null = null;
let lastDist = 0;
let pinchStartScale = 1;
// mouse
let mouseDown = false;
let lastMouse: { x: number; y: number } | null = null;
// wheel 节流
let wheelLock = false;

function ptDist(t1: any, t2: any): number {
	const dx = t1.clientX - t2.clientX;
	const dy = t1.clientY - t2.clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, min: number, max: number): number {
	return Math.min(Math.max(v, min), max);
}

// 获取触点坐标的兼容函数（H5/小程序/App 不同事件结构）
function getPoint(t: any): { x: number; y: number } | null {
	if (!t) return null;
	return { x: t.clientX ?? t.pageX ?? 0, y: t.clientY ?? t.pageY ?? 0 };
}

// 图片当前显示尺寸（基础宽高 * scale）
function displayedSize() {
	return { w: base.w * transform.scale, h: base.h * transform.scale };
}

// 边界 clamp：保证图片边缘始终覆盖裁剪框（不裁出空白）
function clampTransform() {
	const { w: dw, h: dh } = displayedSize();
	// 裁剪框中心相对舞台中心的偏移
	const cropCenterOffsetX = cropLeft.value + cropW.value / 2 - stageW.value / 2;
	const cropCenterOffsetY = cropTop.value + cropH.value / 2 - stageH.value / 2;

	// x 允许范围：图片左边缘 ≤ 裁剪框左边缘 且 图片右边缘 ≥ 裁剪框右边缘
	// 推导：图片中心 x 偏移 = cropCenterOffsetX ± (dw/2 - cropW/2)，当 dw<cropW 时偏移固定为 cropCenterOffsetX
	const halfExtraX = Math.max(0, dw / 2 - cropW.value / 2);
	const halfExtraY = Math.max(0, dh / 2 - cropH.value / 2);
	const maxX = cropCenterOffsetX + halfExtraX;
	const minX = cropCenterOffsetX - halfExtraX;
	const maxY = cropCenterOffsetY + halfExtraY;
	const minY = cropCenterOffsetY - halfExtraY;

	transform.x = clamp(transform.x, minX, maxX);
	transform.y = clamp(transform.y, minY, maxY);
}

// ========== Touch 事件（移动端） ==========
function onTouchStart(e: any) {
	if (!e.touches) return;
	if (e.touches.length === 1) {
		const p = getPoint(e.touches[0]);
		if (!p) return;
		lastPt = p;
		lastDist = 0;
	} else if (e.touches.length === 2) {
		lastDist = ptDist(e.touches[0], e.touches[1]);
		pinchStartScale = transform.scale;
		lastPt = null;
	}
}

function onTouchMove(e: any) {
	if (!e.touches) return;
	if (e.touches.length === 1 && lastPt) {
		const p = getPoint(e.touches[0]);
		if (!p) return;
		transform.x += p.x - lastPt.x;
		transform.y += p.y - lastPt.y;
		lastPt = p;
		clampTransform();
	} else if (e.touches.length === 2 && lastDist > 0) {
		const d = ptDist(e.touches[0], e.touches[1]);
		const ratio = d / lastDist;
		transform.scale = clamp(pinchStartScale * ratio, minScale.value, 3);
		clampTransform();
	}
}

function onTouchEnd() {
	lastPt = null;
	lastDist = 0;
	pinchStartScale = 1;
}

// ========== Mouse 事件（PC/H5） ==========
// 注意：所有鼠标事件通过 @mousedown/@wheel 在模板里绑到 .crop-stage，
// mousemove/mouseup 也绑到 stage DOM 元素本身（onMounted 里通过 ref 绑定），
// 全程不碰 document/window，避免组件卸载后 preventDefault 残留阻塞页面滚动。
function onMouseDown(e: MouseEvent) {
	// 仅响应左键
	if (e.button !== undefined && e.button !== 0) return;
	mouseDown = true;
	lastMouse = { x: e.clientX, y: e.clientY };
	// 尝试 pointer capture：拖出 stage 也能继续接收 mousemove/mouseup
	const t = e.target as HTMLElement | null;
	if (t && typeof (t as any).setPointerCapture === "function" && (e as any).pointerId !== undefined) {
		try { (t as any).setPointerCapture((e as any).pointerId); } catch (_) { /* ignore */ }
	}
}

function onMouseMove(e: MouseEvent) {
	if (!mouseDown || !lastMouse) return;
	const dx = e.clientX - lastMouse.x;
	const dy = e.clientY - lastMouse.y;
	transform.x += dx;
	transform.y += dy;
	lastMouse = { x: e.clientX, y: e.clientY };
	clampTransform();
}

function onMouseUp() {
	mouseDown = false;
	lastMouse = null;
}

function onWheel(e: WheelEvent) {
	// 滚轮事件只在裁剪舞台内触发，阻止默认（不影响外部页面滚动）
	if (e && typeof e.preventDefault === "function") e.preventDefault();
	if (wheelLock) return;
	wheelLock = true;
	setTimeout(() => { wheelLock = false; }, 16);
	// deltaY > 0 向下滚 → 缩小；<0 向上滚 → 放大
	const delta = e.deltaY > 0 ? -0.08 : 0.08;
	zoomBy(delta);
}

function zoomBy(delta: number) {
	transform.scale = clamp(transform.scale + delta, minScale.value, 3);
	clampTransform();
}

function reset() {
	fitImage();
}

// 按 currentRatio 重算裁剪框尺寸，clamp 到舞台可用空间内（宽不超舞台、高不超底栏上方）
function recalcCropSize() {
	const r = currentRatio.value || 1;
	const short = Math.min(stageW.value, stageH.value - footerH - 80);
	let cw = Math.round(short * 0.8);
	let ch = Math.round(cw / r);
	const availH = stageH.value - footerH - 160;
	if (ch > availH) {
		ch = availH;
		cw = Math.round(ch * r);
	}
	const availW = stageW.value - 32;
	if (cw > availW) {
		cw = availW;
		ch = Math.round(cw / r);
	}
	cropW.value = cw;
	cropH.value = ch;
}

// 切换裁剪比例：重算裁剪框并重新 fit 图片（放弃当前拖拽/缩放，因比例已变）
function switchRatio(r: number) {
	if (r === currentRatio.value) return;
	currentRatio.value = r;
	recalcCropSize();
	fitImage();
}

// 取系统尺寸并初始化舞台/裁剪框；就绪后尝试 fit 图片
function initStage() {
	uni.getSystemInfo({
		success: (res) => {
			statusBarH.value = res.statusBarHeight || 0;
			stageW.value = res.windowWidth;
			stageH.value = res.windowHeight;
			recalcCropSize();
			fitImage();
		},
	});
}

// 加载图片
function loadImage() {
	if (!props.src) return;
	uni.getImageInfo({
		src: props.src,
		success: (res) => {
			imgInfo.w = res.width;
			imgInfo.h = res.height;
			imgInfo.path = res.path;
			fitImage();
		},
		fail: () => {
			uni.showToast({ title: "图片加载失败", icon: "none" });
			emit("cancel");
			emit("update:visible", false);
		},
	});
}

// 图片 aspectFit 到舞台，初始缩放刚好盖满裁剪框，且图片中心对齐裁剪框中心
function fitImage() {
	const ow = imgInfo.w;
	const oh = imgInfo.h;
	if (!ow || !oh || !stageW.value || !cropW.value) return;
	const fit = Math.min(stageW.value / ow, (stageH.value - footerH) / oh);
	base.w = ow * fit;
	base.h = oh * fit;
	// 初始/最小 scale = 刚好盖满裁剪框。去除原 max(1,...) 下限：
	// 大图可缩到 50% 甚至更低，仅以"不裁出空白"为下限（clampTransform 配合保证覆盖）。
	const s = Math.max(cropW.value / base.w, cropH.value / base.h);
	minScale.value = s;
	transform.scale = s;
	// 初始位置：图片中心对齐裁剪框中心（裁剪框相对舞台中心可能有垂直偏移）
	const cropCenterOffsetX = cropLeft.value + cropW.value / 2 - stageW.value / 2;
	const cropCenterOffsetY = cropTop.value + cropH.value / 2 - stageH.value / 2;
	transform.x = cropCenterOffsetX;
	transform.y = cropCenterOffsetY;
	// 立即 clamp 到合法边界
	clampTransform();
}

watch(
	() => props.visible,
	(v) => {
		if (v && props.src) {
			initStage();
			nextTick(() => {
				bindStageEvents();
				loadImage();
			});
		} else {
			// 关闭时立即解除所有交互状态，防止残留
			mouseDown = false;
			lastMouse = null;
			lastPt = null;
			lastDist = 0;
			pinchStartScale = 1;
			unbindStageEvents();
			transform.x = 0;
			transform.y = 0;
			transform.scale = 1;
			imgInfo.w = 0;
			imgInfo.h = 0;
			imgInfo.path = "";
		}
	}
);

// 将 mousemove/mouseup 绑到 stage DOM 元素本身（而非 document），
// 组件卸载 / visible=false 时主动解绑，彻底杜绝 preventDefault 残留。
// 仅 window.mouseup 用于兜底释放（拖出浏览器窗口时仍能收到），
// mouseup 处理函数只重置状态不 preventDefault，不会阻塞页面滚动。
let stageEl: HTMLElement | null = null;
function onWindowMouseUp() {
	mouseDown = false;
	lastMouse = null;
}
function bindStageEvents() {
	// #ifdef H5
	nextTick(() => {
		// uni-app Vue3 的 ref 对于原生 view 会返回组件代理，需取 $el；H5 DOM 直接用
		const el = (stageRef.value as any);
		stageEl = (el && el.$el) ? el.$el : (el as HTMLElement | null);
		if (stageEl) {
			stageEl.addEventListener("mousemove", onMouseMove as EventListener);
			stageEl.addEventListener("mouseup", onMouseUp as EventListener);
			stageEl.addEventListener("mouseleave", onMouseUp as EventListener);
		}
		window.addEventListener("mouseup", onWindowMouseUp);
	});
	// #endif
}
function unbindStageEvents() {
	// #ifdef H5
	if (stageEl) {
		stageEl.removeEventListener("mousemove", onMouseMove as EventListener);
		stageEl.removeEventListener("mouseup", onMouseUp as EventListener);
		stageEl.removeEventListener("mouseleave", onMouseUp as EventListener);
		stageEl = null;
	}
	window.removeEventListener("mouseup", onWindowMouseUp);
	// #endif
}

onUnmounted(() => {
	unbindStageEvents();
	mouseDown = false;
	lastMouse = null;
});

function cancel() {
	emit("cancel");
	emit("update:visible", false);
}

async function confirm() {
	const ow = imgInfo.w;
	const oh = imgInfo.h;
	if (!ow || !oh || !imgInfo.path) {
		uni.showToast({ title: "图片未就绪，请稍候", icon: "none" });
		return;
	}
	// 先做一次边界 clamp，防止极端缩放状态下裁出空白
	clampTransform();
	uni.showLoading({ title: "处理中…", mask: true });
	try {
		const fit = Math.min(stageW.value / ow, (stageH.value - footerH) / oh);
		const k = fit * transform.scale;
		const cropCenterOffsetX = cropLeft.value + cropW.value / 2 - stageW.value / 2;
		const cropCenterOffsetY = cropTop.value + cropH.value / 2 - stageH.value / 2;

		// 裁剪框中心在舞台坐标：(stageW/2 + cropCenterOffsetX, stageH/2 + cropCenterOffsetY)
		// 图片中心在舞台坐标：(stageW/2 + transform.x, stageH/2 + transform.y)
		// 裁剪框中心相对图片中心的舞台像素偏移 = (cropCenterOffsetX - x, cropCenterOffsetY - y)
		// 转换到原图像素偏移 = 除 k
		// 裁剪框中心对应的原图像素坐标 = (ow/2 + (cropCenterOffsetX - x)/k, oh/2 + (cropCenterOffsetY - y)/k)
		const cx = ow / 2 + (cropCenterOffsetX - transform.x) / k;
		const cy = oh / 2 + (cropCenterOffsetY - transform.y) / k;

		let sw = cropW.value / k;
		let sh = cropH.value / k;
		let sx = cx - sw / 2;
		let sy = cy - sh / 2;
		// clamp 到图片范围内，防止裁出图外
		sx = clamp(sx, 0, Math.max(0, ow - sw));
		sy = clamp(sy, 0, Math.max(0, oh - sh));
		if (sw > ow) sw = ow;
		if (sh > oh) sh = oh;

		// 输出尺寸：最长边不超过 maxEdge，等比缩
		const outScale = Math.min(1, props.maxEdge / Math.max(sw, sh));
		const dW = Math.max(1, Math.round(sw * outScale));
		const dH = Math.max(1, Math.round(sh * outScale));
		destW.value = dW;
		destH.value = dH;

		await nextTick();
		// H5 下 canvas 尺寸更新到 DOM 需要稍等，否则 drawImage 可能用旧尺寸
		await new Promise(r => setTimeout(r, 50));
		const path = await drawAndExport(sx, sy, sw, sh, dW, dH);
		emit("confirm", path);
		emit("update:visible", false);
	} catch (err) {
		console.error("[wj-cropper] confirm error:", err);
		uni.showToast({ title: "裁剪失败，请重试", icon: "none" });
	} finally {
		uni.hideLoading();
	}
}

// 在离屏 canvas 上按裁剪区域重绘，导出压缩后的临时图
function drawAndExport(
	sx: number, sy: number, sw: number, sh: number,
	dW: number, dH: number
): Promise<string> {
	return new Promise((resolve, reject) => {
		try {
			const ctx = uni.createCanvasContext("wjCropper", scope);
			ctx.clearRect(0, 0, dW, dH);
			ctx.drawImage(imgInfo.path, sx, sy, sw, sh, 0, 0, dW, dH);
			ctx.draw(false, () => {
				// draw 回调在各端都是异步但时序不稳定，H5 下需要再 setTimeout 等真正绘制到 canvas
				setTimeout(() => {
					uni.canvasToTempFilePath(
						{
							canvasId: "wjCropper",
							fileType: "jpg",
							quality: props.quality,
							destWidth: dW,
							destHeight: dH,
							success: (res: any) => {
								if (res && res.tempFilePath) {
									resolve(res.tempFilePath);
								} else {
									reject(new Error("empty tempFilePath"));
								}
							},
							fail: (err: any) => reject(err),
						},
						scope
					);
				}, 100);
			});
		} catch (err) {
			reject(err);
		}
	});
}
</script>

<style scoped>
.wj-cropper {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 999;
	background: #000;
	user-select: none;
	-webkit-user-select: none;
	touch-action: none;
	overscroll-behavior: contain;
}
.crop-header {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 88rpx;
	padding-left: 24rpx;
	padding-right: 24rpx;
	box-sizing: content-box;
	z-index: 3;
	background: rgba(0,0,0,0.3);
}
.crop-title {
	color: #fff;
	font-size: 30rpx;
}
.crop-btn {
	color: #fff;
	font-size: 30rpx;
	padding: 12rpx 8rpx;
}
.crop-btn.done {
	color: var(--wj-primary, #ff6b35);
	font-weight: 600;
}
.crop-stage {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	overflow: hidden;
	touch-action: none;
}
.crop-img {
	position: absolute;
	transform-origin: center center;
	will-change: transform;
	pointer-events: none; /* 图片本身不拦截事件，由 stage 统一处理 */
	-webkit-user-drag: none;
}
.crop-mask {
	position: absolute;
	pointer-events: none;
	border-radius: 4rpx;
}
.crop-frame {
	position: absolute;
	pointer-events: none;
	border: 2rpx solid rgba(255, 255, 255, 0.85);
	box-sizing: border-box;
	border-radius: 4rpx;
}
.grid-line {
	position: absolute;
	background: rgba(255, 255, 255, 0.3);
}
.gh {
	left: 0;
	right: 0;
	height: 1rpx;
}
.gh1 { top: 33.33%; }
.gh2 { top: 66.66%; }
.gv {
	top: 0;
	bottom: 0;
	width: 1rpx;
}
.gv1 { left: 33.33%; }
.gv2 { left: 66.66%; }

.ratio-bar {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 112px;
	display: flex;
	justify-content: center;
	gap: 16rpx;
	z-index: 3;
}
.ratio-chip {
	color: rgba(255, 255, 255, 0.7);
	font-size: 26rpx;
	padding: 8rpx 24rpx;
	border-radius: 24rpx;
	border: 2rpx solid rgba(255, 255, 255, 0.3);
}
.ratio-chip.active {
	color: #fff;
	border-color: var(--wj-primary, #ff6b35);
	background: rgba(255, 107, 53, 0.15);
}

.crop-footer {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 100px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 32rpx;
	background: rgba(0,0,0,0.5);
	z-index: 3;
}
.foot-btn {
	color: #fff;
	font-size: 28rpx;
	padding: 12rpx 16rpx;
}
.zoom-row {
	display: flex;
	align-items: center;
	gap: 24rpx;
}
.zoom-btn {
	width: 64rpx;
	height: 64rpx;
	line-height: 60rpx;
	text-align: center;
	border-radius: 50%;
	border: 2rpx solid rgba(255,255,255,0.6);
	color: #fff;
	font-size: 36rpx;
}
.zoom-val {
	color: #fff;
	font-size: 26rpx;
	min-width: 80rpx;
	text-align: center;
}

.crop-canvas {
	position: absolute;
	left: -9999px;
	top: 0;
	pointer-events: none;
}
</style>
