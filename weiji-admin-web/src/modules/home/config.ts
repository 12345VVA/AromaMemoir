import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 40,
		views: [
			{
				path: '/home',
				meta: { label: '首页' },
				component: () => import('./views/index.vue')
			}
		]
	};
};
