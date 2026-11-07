<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole } from 'lucide-vue-next'
import { auth, errorText, signIn } from '../api'
const username = ref(''), password = ref(''), visible = ref(false), busy = ref(false), error = ref('')
const router = useRouter(), route = useRoute()
async function submit() {
  busy.value = true; error.value = ''
  try {
    await signIn(username.value.trim(), password.value)
    const next = typeof route.query.next === 'string' ? route.query.next : ''
    await router.replace(auth.user?.must_change_password ? '/password' : next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && next !== '/login' ? next : '/catalog')
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
</script>
<template>
  <div class="login-page"><section class="login-story"><div class="brand"><span class="brand-icon"><BookOpen :size="22" /></span><span>courseware</span></div><div class="login-story-content"><p class="eyebrow">A SPACE FOR CURIOUS MINDS</p><h1>不止于看见，<br>更在于<span>理解。</span></h1><p>在交互中发现规律，在尝试中建立直觉。<br>你的下一次探索，从这里开始。</p><div class="login-graph" aria-hidden="true"><div class="graph-axis"></div><div class="graph-line line-one"></div><div class="graph-line line-two"></div><div class="graph-line line-three"></div><span class="graph-point"></span><span class="graph-label">a new perspective.</span></div></div><span class="login-footnote">LEARN. EXPLORE. UNDERSTAND.</span></section><section class="login-form-section"><form class="login-form" @submit.prevent="submit"><span class="overline">欢迎回来</span><h2>继续你的探索</h2><p class="muted">登录账号，进入你的课程空间。</p><div v-if="route.query.changed" class="alert success" role="status">密码已更新，请使用新密码登录。</div><div v-if="error" class="alert error" role="alert">{{ error }}</div><label for="username">用户名</label><input id="username" v-model="username" autocomplete="username" required maxlength="80" placeholder="输入你的用户名" autofocus><label for="password">密码</label><div class="password-input"><input id="password" v-model="password" :type="visible ? 'text' : 'password'" autocomplete="current-password" required maxlength="200" placeholder="输入密码"><button type="button" class="icon-button" :aria-label="visible ? '隐藏密码' : '显示密码'" @click="visible = !visible"><EyeOff v-if="visible" :size="18" /><Eye v-else :size="18" /></button></div><button class="button primary login-submit" :disabled="busy">{{ busy ? '正在登录…' : '进入学习空间' }}<ArrowRight :size="18" /></button><p class="login-help"><LockKeyhole :size="14" />账号由管理员创建。如需账号或重置密码，请联系管理员。</p></form><p class="login-bottom">每一次好奇，都值得一个答案。</p></section></div>
</template>
