import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import Login from '../Login.vue';

// 通过 vi.hoisted 提前创建 spy，供 vi.mock 工厂引用。
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  setAuth: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  elMessageSuccess: vi.fn(),
  elMessageError: vi.fn(),
  elMessageWarning: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useRoute: () => ({ path: '/', name: 'Home' }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    setAuth: mocks.setAuth,
    token: '',
    user: null,
    isLoggedIn: () => false,
  }),
}));

vi.mock('../../api/client', () => ({
  api: {
    login: mocks.login,
    register: mocks.register,
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
  return { Food: stub };
});

// ---- Element Plus 组件桩 ----
const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { expose, slots }) {
    const validate = (cb?: (valid: boolean) => void) => {
      const ok = true;
      if (typeof cb === 'function') cb(ok);
      return Promise.resolve(ok);
    };
    const resetFields = () => {};
    const validateField = () => Promise.resolve(true);
    expose({ validate, resetFields, validateField });
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
  props: ['modelValue', 'type', 'placeholder', 'size', 'showPassword'],
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

function mountLogin() {
  return mount(Login, {
    global: {
      components: {
        ElForm: ElFormStub,
        ElFormItem: ElFormItemStub,
        ElInput: ElInputStub,
        ElButton: ElButtonStub,
        ElIcon: ElIconStub,
      },
    },
  });
}

describe('Login 页面', () => {
  beforeEach(() => {
    mocks.push.mockClear();
    mocks.setAuth.mockClear();
    mocks.login.mockClear();
    mocks.register.mockClear();
    mocks.elMessageSuccess.mockClear();
    mocks.elMessageError.mockClear();
    mocks.elMessageWarning.mockClear();
  });

  it('登录表单提交调用 api.login 并写入 auth、跳转首页', async () => {
    mocks.login.mockResolvedValue({
      token: 'jwt-token',
      user: { id: 1, name: 'demo' },
    });
    const wrapper = mountLogin();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.login).toHaveBeenCalledWith('demo', '123456');
    expect(mocks.setAuth).toHaveBeenCalledWith('jwt-token', { id: 1, name: 'demo' });
    expect(mocks.push).toHaveBeenCalledWith('/');
    expect(mocks.elMessageSuccess).toHaveBeenCalledWith('登录成功');
  });

  it('支持兼容 accessToken / user 缺失的返回结构', async () => {
    mocks.login.mockResolvedValue({ accessToken: 'at', name: 'demo' });
    const wrapper = mountLogin();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.setAuth).toHaveBeenCalledWith('at', { accessToken: 'at', name: 'demo' });
    expect(mocks.push).toHaveBeenCalledWith('/');
  });

  it('切换到注册模式提交调用 api.register', async () => {
    mocks.register.mockResolvedValue({});
    const wrapper = mountLogin();

    await wrapper.find('.switch-link').trigger('click');
    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.register).toHaveBeenCalledWith('demo', '123456', '');
    expect(mocks.elMessageSuccess).toHaveBeenCalledWith('注册成功，请登录');
    // 注册成功后回到登录模式
    expect(wrapper.find('.switch-link').text()).toContain('立即注册');
  });

  it('登录失败时调用 ElMessage.error 且不写入 auth/跳转', async () => {
    mocks.login.mockRejectedValue(new Error('用户名或密码错误'));
    const wrapper = mountLogin();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.login).toHaveBeenCalled();
    expect(mocks.setAuth).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.elMessageError).toHaveBeenCalledWith('用户名或密码错误');
  });
});
