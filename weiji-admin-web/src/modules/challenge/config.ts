import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 50,
		views: [
			{
				path: '/challenge/list',
				meta: { label: '挑战赛配置' },
				component: () => import('./views/list.vue')
			}
		]
	};
};
