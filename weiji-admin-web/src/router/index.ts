import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { path: '/', name: 'Home', component: () => import('../views/Home.vue'), meta: { requiresAuth: true } },
  { path: '/ai-record', name: 'AiRecord', component: () => import('../views/AiRecord.vue'), meta: { requiresAuth: true } },
  { path: '/family', name: 'FamilyRecipes', component: () => import('../views/FamilyRecipes.vue'), meta: { requiresAuth: true } },
  { path: '/achievements', name: 'Achievements', component: () => import('../views/Achievements.vue'), meta: { requiresAuth: true } },
  { path: '/profile', name: 'Profile', component: () => import('../views/Profile.vue'), meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn()) {
    next('/login');
  } else if (to.path === '/login' && auth.isLoggedIn()) {
    next('/');
  } else {
    next();
  }
});

export default router;
