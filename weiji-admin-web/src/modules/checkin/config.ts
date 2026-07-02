import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 40,
		views: [
			{
				path: '/checkin/list',
				meta: { label: '打卡记录' },
				component: () => import('./views/list.vue')
			}
		]
	};
};
