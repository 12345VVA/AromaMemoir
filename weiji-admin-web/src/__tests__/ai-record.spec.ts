/**
 * 迁移自旧工程 weiji-admin-web/src/views/__tests__/AiRecord.spec.ts
 *
 * 适配要点（旧 AiRecord.vue → 新 modules/record/views/ai-record.vue）：
 * - API 模块: import { api } from '../../api/client' → import { appApi } from '/@/modules/business/utils/app-api'
 * - mock 路径: '../../api/client' → '/@/modules/business/utils/app-api'，导出名 api → appApi
 * - 新页面用 useRouter（保存成功后 router.push('/home')），需 mock vue-router
 * - 识别按钮文案 "AI 识别"（仍含"识别"），保存按钮 "保存记录"，美化按钮 "美化图片"
 * - 营养信息由旧版 .nutrition-text 文本 → 4 格 .nutrition-card 卡片（nutrition 须为对象）
 * - 食材 ingredients 兼容字符串/字符串数组/对象数组，字符串按 [,，、] 拆分
 * - 置信度 confidencePercent: c<=1 → c*100，否则 min(100, c)（0.95→95%, 88→88%）
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import AiRecord from '../modules/record/views/ai-record.vue';

const mocks = vi.hoisted(() => ({
	recognizeFood: vi.fn(),
	beautifyImage: vi.fn(),
	saveRecord: vi.fn(),
	routerPush: vi.fn(),
	elMessageSuccess: vi.fn(),
	elMessageError: vi.fn(),
	elMessageWarning: vi.fn()
}));

vi.mock('/@/modules/business/utils/app-api', () => ({
	appApi: {
		recognizeFood: mocks.recognizeFood,
		beautifyImage: mocks.beautifyImage,
		saveRecord: mocks.saveRecord
	}
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: mocks.routerPush }),
	useRoute: () => ({ path: '/' })
}));

vi.mock('element-plus', () => ({
	ElMessage: {
		success: mocks.elMessageSuccess,
		error: mocks.elMessageError,
		warning: mocks.elMessageWarning,
		info: vi.fn()
	}
}));

vi.mock('@element-plus/icons-vue', () => {
	const stub = defineComponent({ name: 'IconStub', render: () => h('i') });
	return { UploadFilled: stub, MagicStick: stub, Brush: stub };
});

const STUB_FILE = new File(['img'], 'food.png', { type: 'image/png' });

// ---- Element Plus 组件桩 ----
const ElUploadStub = defineComponent({
	name: 'ElUpload',
	props: ['autoUpload', 'showFileList', 'accept', 'drag', 'onChange'],
	setup(props, { slots }) {
		return () =>
			h('div', { class: 'el-upload-stub' }, [
				slots.default?.(),
				h(
					'button',
					{
						class: 'stub-file-trigger',
						onClick: () => {
							if (props.onChange) props.onChange({ raw: STUB_FILE });
						}
					},
					'stub-file-trigger'
				)
			]);
	}
});

const ElButtonStub = defineComponent({
	name: 'ElButton',
	props: { type: String, size: String, loading: Boolean, disabled: Boolean },
	emits: ['click'],
	setup(props, { slots, emit }) {
		return () =>
			h(
				'button',
				{
					class: 'el-button-stub',
					disabled: props.disabled || props.loading,
					onClick: (e: any) => emit('click', e)
				},
				slots.default?.()
			);
	}
});

const ElIconStub = defineComponent({
	name: 'ElIcon',
	setup(_, { slots }) {
		return () => h('span', { class: 'el-icon-stub' }, slots.default?.());
	}
});

const ElProgressStub = defineComponent({
	name: 'ElProgress',
	props: { percentage: Number, strokeWidth: Number },
	setup(props) {
		return () => h('div', { class: 'el-progress-stub' }, `${props.percentage ?? 0}%`);
	}
});

const ElTagStub = defineComponent({
	name: 'ElTag',
	props: { size: String, type: String, effect: String },
	setup(_, { slots }) {
		return () => h('span', { class: 'el-tag-stub' }, slots.default?.());
	}
});

const ElFormStub = defineComponent({
	name: 'ElForm',
	setup(_, { slots }) {
		return () => h('form', null, slots.default?.());
	}
});

const ElFormItemStub = defineComponent({
	name: 'ElFormItem',
	props: { label: String, prop: String },
	setup(props, { slots }) {
		return () =>
			h('div', { class: 'el-form-item' }, [
				props.label ? h('label', null, props.label) : null,
				h('div', null, slots.default?.())
			]);
	}
});

const ElInputStub = defineComponent({
	name: 'ElInput',
	props: ['modelValue', 'type', 'placeholder', 'rows', 'size'],
	emits: ['update:modelValue'],
	setup(props, { emit }) {
		return () =>
			h('input', {
				class: 'el-input-stub',
				type: props.type || 'text',
				placeholder: props.placeholder,
				value: props.modelValue ?? '',
				onInput: (e: any) => emit('update:modelValue', e.target.value)
			});
	}
});

const ElRateStub = defineComponent({
	name: 'ElRate',
	props: ['modelValue', 'max', 'disabled', 'allowHalf'],
	setup() {
		return () => h('div', { class: 'el-rate-stub' });
	}
});

// 以下组件桩仅渲染默认 slot，保证页面结构可挂载
const ElRadioGroupStub = defineComponent({
	name: 'ElRadioGroup',
	props: ['modelValue', 'size'],
	setup(_, { slots }) {
		return () => h('div', { class: 'el-radio-group-stub' }, slots.default?.());
	}
});
const ElRadioButtonStub = defineComponent({
	name: 'ElRadioButton',
	props: { value: String },
	setup(_, { slots }) {
		return () => h('span', { class: 'el-radio-button-stub' }, slots.default?.());
	}
});
const ElSelectStub = defineComponent({
	name: 'ElSelect',
	props: ['modelValue', 'placeholder'],
	setup(_, { slots }) {
		return () => h('div', { class: 'el-select-stub' }, slots.default?.());
	}
});
const ElOptionStub = defineComponent({
	name: 'ElOption',
	props: { label: String, value: String },
	setup() {
		return () => h('div', { class: 'el-option-stub' });
	}
});
const ElRowStub = defineComponent({
	name: 'ElRow',
	setup(_, { slots }) {
		return () => h('div', { class: 'el-row-stub' }, slots.default?.());
	}
});
const ElColStub = defineComponent({
	name: 'ElCol',
	props: { span: Number },
	setup(_, { slots }) {
		return () => h('div', { class: 'el-col-stub' }, slots.default?.());
	}
});

function mountAiRecord() {
	return mount(AiRecord, {
		global: {
			components: {
				ElUpload: ElUploadStub,
				ElButton: ElButtonStub,
				ElIcon: ElIconStub,
				ElProgress: ElProgressStub,
				ElTag: ElTagStub,
				ElForm: ElFormStub,
				ElFormItem: ElFormItemStub,
				ElInput: ElInputStub,
				ElRate: ElRateStub,
				ElRadioGroup: ElRadioGroupStub,
				ElRadioButton: ElRadioButtonStub,
				ElSelect: ElSelectStub,
				ElOption: ElOptionStub,
				ElRow: ElRowStub,
				ElCol: ElColStub
			}
		}
	});
}

describe('AiRecord 页面', () => {
	beforeAll(() => {
		// jsdom 未实现 createObjectURL，桩成固定值以便预览逻辑可执行。
		(URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
	});

	beforeEach(() => {
		mocks.recognizeFood.mockReset();
		mocks.beautifyImage.mockReset();
		mocks.saveRecord.mockReset();
		mocks.routerPush.mockClear();
		mocks.elMessageSuccess.mockClear();
		mocks.elMessageError.mockClear();
		mocks.elMessageWarning.mockClear();
	});

	it('文件选择后更新 previewUrl 并显示预览图', async () => {
		const wrapper = mountAiRecord();

		expect(wrapper.find('.preview-img').exists()).toBe(false);
		expect(wrapper.find('.upload-placeholder').exists()).toBe(true);

		await wrapper.find('.stub-file-trigger').trigger('click');
		await flushPromises();

		expect(URL.createObjectURL).toHaveBeenCalled();
		const img = wrapper.find('.preview-img');
		expect(img.exists()).toBe(true);
		expect(img.attributes('src')).toBe('blob:mock-url');
	});

	it('handleRecognize 调用 appApi.recognizeFood 并展示菜名与置信度', async () => {
		mocks.recognizeFood.mockResolvedValue({
			dishName: '宫保鸡丁',
			confidence: 0.95,
			ingredients: ['鸡肉', '花生', '辣椒'],
			nutrition: { calories: 250, protein: 20 }
		});
		const wrapper = mountAiRecord();

		// 先选文件（否则识别按钮 disabled）
		await wrapper.find('.stub-file-trigger').trigger('click');

		const buttons = wrapper.findAll('button');
		const recognizeBtn = buttons.find((b) => b.text().includes('识别'));
		expect(recognizeBtn).toBeTruthy();
		await recognizeBtn!.trigger('click');
		await flushPromises();

		expect(mocks.recognizeFood).toHaveBeenCalledTimes(1);
		expect(mocks.recognizeFood).toHaveBeenCalledWith(STUB_FILE);
		expect(mocks.elMessageSuccess).toHaveBeenCalledWith('识别完成');

		// 菜名展示
		expect(wrapper.text()).toContain('宫保鸡丁');
		// 置信度 0.95 -> 95%
		expect(wrapper.find('.el-progress-stub').text()).toContain('95%');
	});

	it('识别结果展示 ingredients 标签与 nutrition 卡片', async () => {
		mocks.recognizeFood.mockResolvedValue({
			dishName: '番茄炒蛋',
			confidence: 88,
			ingredients: '番茄,鸡蛋,葱花',
			nutrition: { calories: 180 }
		});
		const wrapper = mountAiRecord();

		await wrapper.find('.stub-file-trigger').trigger('click');
		const recognizeBtn = wrapper
			.findAll('button')
			.find((b) => b.text().includes('识别'));
		await recognizeBtn!.trigger('click');
		await flushPromises();

		// 字符串食材按 ,，、 拆分为 3 个标签（限定在 result-section 内，排除保存区标签）
		const tags = wrapper.find('.result-section').findAll('.el-tag-stub');
		expect(tags).toHaveLength(3);
		expect(tags.map((t) => t.text())).toEqual(['番茄', '鸡蛋', '葱花']);

		// 营养信息卡片（新版用 4 格卡片替代旧版 .nutrition-text 文本）
		expect(wrapper.find('.nutrition-card--calories').text()).toContain('180');
	});

	it('识别失败时调用 ElMessage.error 且不展示结果区', async () => {
		mocks.recognizeFood.mockRejectedValue(new Error('识别服务异常'));
		const wrapper = mountAiRecord();

		await wrapper.find('.stub-file-trigger').trigger('click');
		const recognizeBtn = wrapper
			.findAll('button')
			.find((b) => b.text().includes('识别'));
		await recognizeBtn!.trigger('click');
		await flushPromises();

		expect(mocks.elMessageError).toHaveBeenCalledWith('识别服务异常');
		expect(wrapper.find('.result-section').exists()).toBe(false);
	});

	it('未选文件时识别按钮被禁用', async () => {
		const wrapper = mountAiRecord();
		const recognizeBtn = wrapper
			.findAll('button')
			.find((b) => b.text().includes('识别'));
		expect(recognizeBtn!.attributes('disabled')).toBeDefined();
		expect(mocks.recognizeFood).not.toHaveBeenCalled();
	});
});
