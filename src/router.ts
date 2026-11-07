import { createRouter, createWebHistory } from 'vue-router'
import { auth, loadAuth } from './api'
import CatalogPage from './pages/CatalogPage.vue'
import DetailPage from './pages/DetailPage.vue'
import LoginPage from './pages/LoginPage.vue'
import PasswordPage from './pages/PasswordPage.vue'
import AdminPage from './pages/AdminPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/catalog' },
    { path: '/login', component: LoginPage, meta: { title: '登录' } },
    { path: '/catalog', component: CatalogPage, meta: { title: '探索课程' } },
    { path: '/catalog/:slug', component: DetailPage, meta: { title: '课程详情' } },
    { path: '/password', component: PasswordPage, meta: { title: '账号设置' } },
    { path: '/admin', redirect: '/admin/courses' },
    { path: '/admin/:section(courses|users)', component: AdminPage, meta: { title: '平台管理', admin: true } },
    { path: '/:pathMatch(.*)*', component: NotFoundPage, meta: { title: '页面不存在' } },
  ],
})
router.beforeEach(async to => {
  if (!auth.ready) {
    try { await loadAuth() } catch { if (to.path !== '/login') return '/login' }
  }
  if (!auth.user && to.path !== '/login') return { path: '/login', query: { next: to.fullPath } }
  if (auth.user?.must_change_password && !['/password', '/login'].includes(to.path)) return '/password'
  if (auth.user && to.path === '/login') return auth.user.must_change_password ? '/password' : '/catalog'
  if (to.meta.admin && auth.user?.role !== 'admin') return '/catalog'
})
router.afterEach(to => { document.title = `${to.meta.title || '课程'} · Courseware` })
