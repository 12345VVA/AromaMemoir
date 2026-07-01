import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 20,
		views: [
			{
				path: '/family/recipes',
				meta: { label: '家庭菜谱' },
				component: () => import('./views/recipes.vue')
			},
			{
				path: '/family/recipe/form',
				meta: { label: '新建菜谱' },
				component: () => import('./views/recipe-form.vue')
			},
			{
				path: '/family/recipe/:id',
				meta: { label: '菜谱详情' },
				component: () => import('./views/recipe-detail.vue')
			},
			{
				path: '/family/list',
				meta: { label: '家庭组管理' },
				component: () => import('./views/list.vue')
			}
		]
	};
};
