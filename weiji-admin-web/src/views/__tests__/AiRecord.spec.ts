import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import AiRecord from '../AiRecord.vue';

const mocks = vi.hoisted(() => ({
  recognizeFood: vi.fn(),
  beautifyImage: vi.fn(),
  saveRecord: vi.fn(),
  elMessageSuccess: vi.fn(),
  elMessageError: vi.fn(),
  elMessageWarning: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  api: {
    recognizeFood: mocks.recognizeFood,
    beautifyImage: mocks.beautifyImage,
    saveRecord: mocks.saveRecord,
  },
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    success: mocks.elMessageSuccess,
    error: mocks.elMessageError,
    warning: mocks.elMessageWarning,
    info: vi.fn(),
  },
}));

vi.mock('@element-plus/icons-vue', () => {
  const stub = defineComponent({ name: 'IconStub', render: () => h('i') });
  return { UploadFilled: stub, MagicStick: stub, Brush: stub };
});

// Layout 真实组件依赖 vue-router，桩成只渲染默认 slot 的容器以隔离路由。
vi.mock('../../components/Layout.vue', () => ({
  default: defineComponent({
    name: 'Layout',
    setup(_, { slots }) {
      return () => h('div', { class: 'layout-stub' }, slots.default?.());
    },
  }),
}));

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
            },
          },
          'stub-file-trigger'
        ),
      ]);
  },
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
          onClick: (e: any) => emit('click', e),
        },
        slots.default?.()
      );
  },
});

const ElIconStub = defineComponent({
  name: 'ElIcon',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-icon-stub' }, slots.default?.());
  },
});

const ElProgressStub = defineComponent({
  name: 'ElProgress',
  props: { percentage: Number, strokeWidth: Number },
  setup(props) {
    return () => h('div', { class: 'el-progress-stub' }, `${props.percentage ?? 0}%`);
  },
});

const ElTagStub = defineComponent({
  name: 'ElTag',
  props: { size: String, type: String, effect: String },
  setup(_, { slots }) {
    return () => h('span', { class: 'el-tag-stub' }, slots.default?.());
  },
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots }) {
    return () => h('form', null, slots.default?.());
  },
});

const ElFormItemStub = defineComponent({
  name: 'ElFormItem',
  props: { label: String, prop: String },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'el-form-item' }, [
        props.label ? h('label', null, props.label) : null,
        h('div', null, slots.default?.()),
      ]);
  },
});

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: ['modelValue', 'type', 'placeholder', 'rows'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'el-input-stub',
        type: props.type || 'text',
        placeholder: props.placeholder,
        value: props.modelValue ?? '',
        onInput: (e: any) => emit('update:modelValue', e.target.value),
      });
  },
});

const ElRateStub = defineComponent({
  name: 'ElRate',
  props: ['modelValue', 'max', 'disabled', 'allowHalf'],
  emits: ['update:modelValue'],
  setup() {
    return () => h('div', { class: 'el-rate-stub' });
  },
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
      },
    },
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
    mocks.elMessageSuccess.mockClear();
    mocks.elMessageError.mockClear();
    mocks.elMessageWarning.mockClear();
  });

  it('文件选择后更新 imageUrl 并显示预览图', async () => {
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

  it('handleRecognize 调用 api.recognizeFood 并展示菜名与置信度', async () => {
    mocks.recognizeFood.mockResolvedValue({
      dishName: '宫保鸡丁',
      confidence: 0.95,
      ingredients: ['鸡肉', '花生', '辣椒'],
      nutrition: '热量 250 kcal, 蛋白质 20g',
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

  it('识别结果展示 ingredients 标签与 nutrition 文本', async () => {
    mocks.recognizeFood.mockResolvedValue({
      dishName: '番茄炒蛋',
      confidence: 88,
      ingredients: '番茄,鸡蛋,葱花',
      nutrition: '热量 180 kcal',
    });
    const wrapper = mountAiRecord();

    await wrapper.find('.stub-file-trigger').trigger('click');
    const recognizeBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('识别'));
    await recognizeBtn!.trigger('click');
    await flushPromises();

    // 字符串食材按 ,，、 拆分为 3 个标签
    const tags = wrapper.findAll('.el-tag-stub');
    expect(tags).toHaveLength(3);
    expect(tags.map((t) => t.text())).toEqual(['番茄', '鸡蛋', '葱花']);

    // 营养信息文本
    expect(wrapper.find('.nutrition-text').text()).toContain('热量 180 kcal');
  });

  it('识别失败时调用 ElMessage.error', async () => {
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
