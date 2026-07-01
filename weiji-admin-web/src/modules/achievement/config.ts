import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 20,
		views: [
			{
				path: '/achievement',
				meta: { label: '成就' },
				component: () => import('./views/index.vue')
			},
			{
				path: '/achievement/list',
				meta: { label: '成就管理' },
				component: () => import('./views/list.vue')
			}
		]
	};
};
