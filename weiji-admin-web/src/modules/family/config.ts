import { type ModuleConfig } from '/@/cool';

export default (): ModuleConfig => {
	return {
		order: 20,
		views: [
			{
				path: '/family/list',
				meta: { label: '家庭组管理' },
				component: () => import('./views/list.vue')
			},
			{
				path: '/family/recipes',
				meta: { label: '家庭菜谱' },
				component: () => import('./views/recipes.vue')
			},
			{
				path: '/family/menu',
				meta: { label: '周菜单管理' },
				component: () => import('./views/menu.vue')
			},
			{
				path: '/family/member',
				meta: { label: '家庭成员' },
				component: () => import('./views/member.vue')
			},
			{
				path: '/family/invitation',
				meta: { label: '邀请码管理' },
				component: () => import('./views/invitation.vue')
			},
			{
				path: '/family/shopping',
				meta: { label: '购物清单' },
				component: () => import('./views/shopping.vue')
			}
		]
	};
};
