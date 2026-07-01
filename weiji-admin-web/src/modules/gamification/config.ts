import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 10,
		views: [
			{
				path: '/gamification',
				meta: { label: '趣味玩法' },
				component: () => import('./views/index.vue')
			}
		]
	};
};
