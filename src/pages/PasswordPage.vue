<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound } from 'lucide-vue-next'
import { api, auth, errorText } from '../api'
const current = ref(''), next = ref(''), confirm = ref(''), error = ref(''), busy = ref(false)
const router = useRouter()
async function submit() {
  error.value = ''
  if (next.value !== confirm.value) { error.value = '两次输入的新密码不一致'; return }
  busy.value = true
  try {
    await api('/auth/password', { method: 'PUT', body: JSON.stringify({ current_password: current.value, new_password: next.value }) })
    auth.user = null; auth.csrf = ''
    await router.replace('/login?changed=1')
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
</script>
<template><div class="page-heading"><p class="eyebrow">YOUR ACCOUNT</p><h1>账号设置</h1><p class="muted">管理你的登录密码，让学习空间保持安全。</p></div><section class="settings-card"><span class="panel-icon"><KeyRound :size="22" /></span><h2>修改密码</h2><p v-if="auth.user?.must_change_password" class="alert notice">首次登录需要修改初始密码，再开始浏览课程。</p><p class="muted">至少 12 个字符。修改后，所有设备上的登录会话都会退出。</p><form @submit.prevent="submit"><div v-if="error" class="alert error" role="alert">{{ error }}</div><label for="current">当前密码</label><input id="current" v-model="current" type="password" autocomplete="current-password" required><label for="next">新密码</label><input id="next" v-model="next" type="password" autocomplete="new-password" minlength="12" maxlength="200" required><label for="confirm">确认新密码</label><input id="confirm" v-model="confirm" type="password" autocomplete="new-password" minlength="12" required><button class="button primary" :disabled="busy">{{ busy ? '正在保存…' : '更新密码' }}</button></form></section></template>
