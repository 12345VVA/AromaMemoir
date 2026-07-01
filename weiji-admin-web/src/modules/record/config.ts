import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 30,
		views: [
			{
				path: '/record/ai-record',
				meta: { label: 'AI 记录' },
				component: () => import('./views/ai-record.vue')
			},
			{
				path: '/record/list',
				meta: { label: '记录管理' },
				component: () => import('./views/list.vue')
			}
		]
	};
};
