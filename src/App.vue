<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, BookOpen, Compass, Library, LogOut, Menu, Settings2, Users, X } from 'lucide-vue-next'
import { auth, errorText, signOut } from './api'

const route = useRoute(), router = useRouter()
const mobileOpen = ref(false), error = ref(''), leaving = ref(false)
const login = computed(() => route.path === '/login')
const sessionEnded = () => router.replace({ path: '/login', query: { next: route.fullPath } })
onMounted(() => window.addEventListener('courseware:session-ended', sessionEnded))
onUnmounted(() => window.removeEventListener('courseware:session-ended', sessionEnded))
async function logout() {
  leaving.value = true
  try { await signOut(); await router.replace('/login') } catch (e) { error.value = errorText(e) }
  finally { leaving.value = false }
}
</script>

<template>
  <RouterView v-if="login" />
  <div v-else class="app-shell">
    <a class="skip-link" href="#main">跳转到主要内容</a>
    <button v-if="mobileOpen" class="sidebar-backdrop" aria-label="关闭导航" @click="mobileOpen = false"></button>
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <RouterLink to="/catalog" class="brand" @click="mobileOpen = false"><span class="brand-icon"><BookOpen :size="21" /></span><span>courseware<span class="brand-caption">让理解发生</span></span></RouterLink>
      <button class="icon-button mobile-close" aria-label="关闭导航" @click="mobileOpen = false"><X :size="20" /></button>
      <p class="nav-label">学习空间</p>
      <nav aria-label="主导航">
        <RouterLink to="/catalog" class="nav-link" @click="mobileOpen = false"><Compass :size="18" />探索课程<span class="nav-dot"></span></RouterLink>
        <RouterLink to="/password" class="nav-link" @click="mobileOpen = false"><Settings2 :size="18" />账号设置</RouterLink>
        <template v-if="auth.user?.role === 'admin'"><p class="nav-label management-label">工作台</p><RouterLink to="/admin/courses" class="nav-link" @click="mobileOpen = false"><Library :size="18" />课程管理</RouterLink><RouterLink to="/admin/users" class="nav-link" @click="mobileOpen = false"><Users :size="18" />用户与权限</RouterLink></template>
      </nav>
      <div class="sidebar-note"><span class="tiny-spark">✳</span><p>知识不止于阅读，<br>也发生在每一次尝试。</p><span>LEARN BY EXPLORING</span></div>
      <div class="sidebar-user"><span class="avatar">{{ auth.user?.display_name.slice(0, 1) }}</span><div><strong>{{ auth.user?.display_name }}</strong><small>{{ auth.user?.role === 'admin' ? '平台管理员' : '学习成员' }}</small></div><button class="icon-button" :disabled="leaving" aria-label="退出登录" title="退出登录" @click="logout"><LogOut :size="16" /></button></div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="topbar-left"><button class="icon-button mobile-menu" aria-label="打开导航" :aria-expanded="mobileOpen" @click="mobileOpen = true"><Menu :size="21" /></button><span class="breadcrumb">学习空间 <span>/</span> <strong>{{ route.meta.title }}</strong></span></div><div class="topbar-right"><span class="status-dot"></span><span>交互式课程平台</span><ArrowUpRight :size="15" /></div></header><main id="main" tabindex="-1"><div v-if="error" class="alert error" role="alert">{{ error }}</div><RouterView /></main><footer class="app-footer"><span>COURSEWARE <span class="footer-slash">/</span> 理解，从探索开始。</span><span>KEEP YOUR CURIOSITY.</span></footer></div>
  </div>
</template>
