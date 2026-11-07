<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowUpRight, Check, GitBranch, History, KeyRound, LoaderCircle, Plus, RefreshCw, Settings2, ShieldCheck, Users } from 'lucide-vue-next'
import DialogPanel from '../components/DialogPanel.vue'
import { api, dateText, errorText, type AdminCourse, type Job, type Page, type Release, type User } from '../api'

const route = useRoute(), isUsers = computed(() => route.params.section === 'users')
const courses = ref<AdminCourse[]>([]), users = ref<User[]>([]), total = ref(0), page = ref(1)
const loading = ref(true), error = ref(''), message = ref(''), busy = ref(false)
const open = ref(false), mode = ref(''), title = ref(''), dialogError = ref(''), dialogLoading = ref(false)
const selectedCourse = ref<AdminCourse | null>(null), selectedUser = ref<User | null>(null)
const releases = ref<Release[]>([]), grantUsers = ref<User[]>([]), grantIds = ref<string[]>([]), grantVersion = ref(0)
const form = reactive({ username: '', display_name: '', password: '', role: 'member', slug: '', repo_url: '', branch: 'main', credential_ref: '', enabled: true, access_policy: 'authenticated', featured: false })
const confirmMessage = ref(''), reason = ref(''), needReason = ref(false)
let action: (() => Promise<unknown>) | null = null, timer: ReturnType<typeof setTimeout> | undefined, request = 0, disposed = false

async function load(silent = false) {
  const id = ++request
  if (!silent) loading.value = true
  error.value = ''
  try {
    if (isUsers.value) {
      const result = await api<Page<User>>(`/admin/users?page=${page.value}&page_size=20`)
      if (id !== request) return
      users.value = result.items; total.value = result.total
    } else {
      const result = await api<Page<AdminCourse>>(`/admin/courses?page=${page.value}&page_size=20`)
      if (id !== request) return
      courses.value = result.items; total.value = result.total
      clearTimeout(timer)
      if (!disposed && result.items.some(c => ['queued', 'running'].includes(c.latest_job?.status || ''))) timer = setTimeout(() => load(true), 2000)
    }
  } catch (e) { if (id === request) error.value = errorText(e) }
  finally { if (id === request) loading.value = false }
}
watch(() => route.params.section, () => { clearTimeout(timer); page.value = 1; message.value = ''; open.value = false; load() }, { immediate: true })
onUnmounted(() => { disposed = true; clearTimeout(timer); request++ })
function goPage(value: number) { page.value = value; load() }
function show(nextMode: string, heading: string) { mode.value = nextMode; title.value = heading; dialogError.value = ''; open.value = true }
function newUser() { selectedUser.value = null; Object.assign(form, { username: '', display_name: '', password: '', role: 'member' }); show('user', '邀请一位新成员') }
function editUser(user: User) { selectedUser.value = user; Object.assign(form, user, { password: '' }); show('user', '编辑成员信息') }
function newCourse() { selectedCourse.value = null; Object.assign(form, { slug: '', repo_url: '', branch: 'main', credential_ref: '', enabled: true }); show('course', '接入一门新课程') }
function source(course: AdminCourse) { selectedCourse.value = course; Object.assign(form, { repo_url: '', branch: 'main', credential_ref: '', enabled: true }, course.source || {}, { credential_ref: course.source?.credential_ref || '' }); show('source', '配置课程仓库') }
function options(course: AdminCourse) { selectedCourse.value = course; form.access_policy = course.access_policy; form.featured = course.featured; show('options', '课程访问设置') }
function reset(user: User) { selectedUser.value = user; form.password = ''; show('reset', `重置 ${user.display_name} 的密码`) }
function confirm(heading: string, text: string, fn: () => Promise<unknown>, withReason = false) { confirmMessage.value = text; action = fn; needReason.value = withReason; reason.value = ''; show('confirm', heading) }
async function grants(course: AdminCourse) {
  selectedCourse.value = course; grantIds.value = []; grantUsers.value = []; show('grants', '指定可访问的成员'); dialogLoading.value = true
  try {
    const grants = await api<{ user_ids: string[]; version: number }>(`/admin/courses/${course.id}/grants`)
    grantIds.value = grants.user_ids; grantVersion.value = grants.version
    let cursor = 1, loaded = 0, count = 1
    while (loaded < count) {
      const result = await api<Page<User>>(`/admin/users?page=${cursor++}&page_size=100`)
      grantUsers.value.push(...result.items); loaded += result.items.length; count = result.total
      if (!result.items.length) break
    }
  } catch (e) { dialogError.value = errorText(e) } finally { dialogLoading.value = false }
}
async function history(course: AdminCourse) {
  selectedCourse.value = course; releases.value = []; show('history', `${course.title} · 发布历史`); dialogLoading.value = true
  try { releases.value = (await api<{ items: Release[] }>(`/admin/courses/${course.id}/releases`)).items }
  catch (e) { dialogError.value = errorText(e) } finally { dialogLoading.value = false }
}
async function sync(course: AdminCourse) {
  busy.value = true; message.value = ''; error.value = ''
  try {
    // getRandomValues also works on HTTP entrances forwarded through frpc.
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    await api<Job>(`/admin/courses/${course.id}/sync`, { method: 'POST', headers: { 'Idempotency-Key': key } }); message.value = '更新任务已加入队列，状态会自动刷新。'; await load(true)
  }
  catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
async function save() {
  busy.value = true; dialogError.value = ''
  try {
    if (mode.value === 'user') {
      await api(selectedUser.value ? `/admin/users/${selectedUser.value.id}` : '/admin/users', { method: selectedUser.value ? 'PATCH' : 'POST', body: JSON.stringify(selectedUser.value ? { display_name: form.display_name, role: form.role } : { username: form.username, display_name: form.display_name, password: form.password, role: form.role }) })
    } else if (mode.value === 'course' || mode.value === 'source') {
      const payload = { repo_url: form.repo_url.trim(), branch: form.branch.trim(), credential_ref: form.credential_ref.trim() || null, enabled: form.enabled }
      await api(mode.value === 'course' ? '/admin/courses' : `/admin/courses/${selectedCourse.value!.id}/source`, { method: mode.value === 'course' ? 'POST' : 'PUT', body: JSON.stringify(mode.value === 'course' ? { ...payload, slug: form.slug } : payload) })
    } else if (mode.value === 'options') {
      await api(`/admin/courses/${selectedCourse.value!.id}`, { method: 'PATCH', body: JSON.stringify({ access_policy: form.access_policy, featured: form.featured }) })
    } else if (mode.value === 'grants') {
      await api(`/admin/courses/${selectedCourse.value!.id}/grants`, { method: 'PUT', body: JSON.stringify({ user_ids: grantIds.value, expected_version: grantVersion.value }) })
    } else if (mode.value === 'reset') {
      await api(`/admin/users/${selectedUser.value!.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: form.password }) })
    } else if (mode.value === 'confirm' && action) await action()
    open.value = false; form.password = ''; message.value = '操作已完成。'; await load(true)
  } catch (e) { dialogError.value = errorText(e) } finally { busy.value = false }
}
function toggleCourse(course: AdminCourse) {
  const next = course.listing_status === 'listed' ? 'unlisted' : 'listed'
  confirm(next === 'listed' ? '上架课程' : '下架课程', `${course.title}：${next === 'listed' ? '上架后，符合访问条件的成员可以检索并打开课程。' : '下架后，普通成员将无法检索或访问课程文件。'}`, () => api(`/admin/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify({ listing_status: next }) }))
}
function toggleUser(user: User) {
  const status = user.status === 'active' ? 'disabled' : 'active'
  confirm(status === 'disabled' ? '停用成员' : '启用成员', `对 ${user.display_name} 执行此操作。停用会立即撤销该账号的全部会话。`, () => api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }))
}
function activate(release: Release) {
  const course = selectedCourse.value!
  confirm('切换课程版本', `将切换到「${release.title}」。页面文件、课程目录和检索内容会同时恢复到该版本。`, () => api(`/admin/courses/${course.id}/activate`, { method: 'POST', body: JSON.stringify({ release_id: release.id, expected_current_release_id: course.current_release_id, reason: reason.value }) }), true)
}
function revoke(release: Release) {
  const course = selectedCourse.value!
  confirm('撤销版本访问', '这个版本的文件将立即停止对所有用户提供访问。当前版本需先下架课程或切换到其他版本。', () => api(`/admin/courses/${course.id}/releases/${release.id}/revoke`, { method: 'POST' }))
}
</script>

<template>
  <div class="page-heading heading-with-action"><div><p class="eyebrow">THE WORKSPACE</p><h1>{{ isUsers ? '一起，让学习发生。' : '把好课程，带到这里。' }}</h1><p class="muted">{{ isUsers ? '管理成员账号与角色，每位成员拥有独立的学习空间。' : '连接课程仓库，让内容、目录与版本保持同步。' }}</p></div><button class="button primary" @click="isUsers ? newUser() : newCourse()"><Plus :size="17" />{{ isUsers ? '新增成员' : '接入课程' }}</button></div>
  <div class="admin-tabs"><RouterLink to="/admin/courses"><GitBranch :size="16" />课程与发布</RouterLink><RouterLink to="/admin/users"><Users :size="16" />成员账号</RouterLink></div>
  <div v-if="message" class="alert success" role="status"><Check :size="17" />{{ message }}</div><div v-if="error" class="alert error" role="alert">{{ error }}<button class="text-button" @click="load()">重试</button></div>
  <section class="table-panel"><div class="table-heading"><h2>{{ isUsers ? '全部成员' : '课程仓库' }} <span>{{ total }}</span></h2><button class="icon-button" aria-label="刷新列表" @click="load()"><RefreshCw :size="16" /></button></div><div v-if="loading" class="loading-panel" role="status">正在加载…</div><div v-else-if="!total" class="empty-state"><h3>{{ isUsers ? '还没有成员' : '让第一门课程在这里相遇' }}</h3><p>{{ isUsers ? '创建账号后，将初始密码交给对应成员。' : '登记课程仓库，完成同步后即可上架。' }}</p><button class="button secondary" @click="isUsers ? newUser() : newCourse()">{{ isUsers ? '新增成员' : '接入课程' }}</button></div>
  <div v-else class="table-scroll"><table v-if="isUsers"><thead><tr><th>成员</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="user in users" :key="user.id"><td><div class="table-person"><span class="avatar">{{ user.display_name.slice(0, 1) }}</span><div><strong>{{ user.display_name }}</strong><small>{{ user.username }}</small></div></div></td><td>{{ user.role === 'admin' ? '管理员' : '学习成员' }}</td><td><span class="badge" :class="user.status === 'active' ? 'good' : 'neutral'">{{ user.status === 'active' ? '已启用' : '已停用' }}</span><small v-if="user.must_change_password" class="cell-note">首次登录需改密</small></td><td><div class="table-actions"><button class="text-button" @click="editUser(user)">编辑</button><button class="text-button" @click="reset(user)"><KeyRound :size="13" />重置密码</button><button class="text-button" :class="{ danger: user.status === 'active' }" @click="toggleUser(user)">{{ user.status === 'active' ? '停用' : '启用' }}</button></div></td></tr></tbody></table>
  <table v-else><thead><tr><th>课程</th><th>发布与访问</th><th>最近更新</th><th>操作</th></tr></thead><tbody><tr v-for="course in courses" :key="course.id"><td><RouterLink :to="`/catalog/${course.slug}`" class="table-course-title">{{ course.title }}<ArrowUpRight :size="13" /></RouterLink><small class="cell-note">{{ course.slug }}</small><small class="cell-note source-line"><GitBranch :size="11" />{{ course.source?.branch || '本地预览' }}</small></td><td><span class="badge" :class="course.listing_status === 'listed' ? 'good' : 'neutral'">{{ course.listing_status === 'listed' ? '已上架' : '未上架' }}</span><small class="cell-note">{{ course.access_policy === 'restricted' ? '指定成员可见' : '所有成员可见' }}</small></td><td><template v-if="course.latest_job"><span class="job-status" :class="course.latest_job.status"><LoaderCircle v-if="['queued', 'running'].includes(course.latest_job.status)" :size="14" class="spinning" />{{ ({ succeeded: '更新完成', failed: '更新失败', queued: '等待执行', running: '正在更新' } as Record<string,string>)[course.latest_job.status] }}</span><small class="cell-note">{{ dateText(course.latest_job.created_at) }}</small><p v-if="course.latest_job.error_message" class="job-error">{{ course.latest_job.error_message }}</p></template><span v-else class="muted">尚未同步</span></td><td><div class="table-actions"><button class="text-button" :disabled="busy || !course.source?.enabled || ['running', 'queued'].includes(course.latest_job?.status || '')" @click="sync(course)"><RefreshCw :size="13" />同步</button><button class="text-button" @click="history(course)"><History :size="13" />版本</button><button class="text-button" @click="source(course)"><GitBranch :size="13" />仓库</button><button class="text-button" @click="options(course)"><Settings2 :size="13" />设置</button><button class="text-button" @click="grants(course)"><ShieldCheck :size="13" />授权</button><button class="text-button" @click="toggleCourse(course)">{{ course.listing_status === 'listed' ? '下架' : '上架' }}</button></div></td></tr></tbody></table></div>
  <div v-if="total" class="pagination"><span>共 {{ total }} {{ isUsers ? '位成员' : '门课程' }}</span><div><button class="button small secondary" :disabled="page === 1" @click="goPage(page - 1)">上一页</button><span>{{ page }} / {{ Math.ceil(total / 20) }}</span><button class="button small secondary" :disabled="page * 20 >= total" @click="goPage(page + 1)">下一页</button></div></div></section>
  <p v-if="!isUsers" class="admin-footnote"><ShieldCheck :size="15" />课程标题、封面和章节由课程仓库维护。更新失败时，已发布版本继续提供访问。</p>
  <DialogPanel v-model="open" :title="title"><div v-if="dialogError" class="alert error" role="alert">{{ dialogError }}</div><div v-if="dialogLoading" class="loading-panel" role="status">正在加载…</div><form v-else @submit.prevent="save">
    <template v-if="mode === 'user'"><label v-if="!selectedUser" for="new-username">用户名</label><input v-if="!selectedUser" id="new-username" v-model="form.username" pattern="[a-z][a-z0-9._\-]{2,79}" required placeholder="小写字母开头，至少 3 位" autocomplete="off"><label for="display-name">展示名称</label><input id="display-name" v-model="form.display_name" maxlength="100" required><label for="user-role">账号角色</label><select id="user-role" v-model="form.role"><option value="member">学习成员</option><option value="admin">管理员</option></select><template v-if="!selectedUser"><label for="new-password">初始密码</label><input id="new-password" v-model="form.password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"><p class="form-hint">至少 12 个字符。成员首次登录后必须修改密码。</p></template></template>
    <template v-else-if="mode === 'course' || mode === 'source'"><template v-if="mode === 'course'"><label for="course-slug">课程标识</label><input id="course-slug" v-model="form.slug" minlength="2" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如 numerical-methods" required><p class="form-hint">与课程清单一致，创建后保持稳定。</p></template><label for="repo-url">Git 仓库地址</label><input id="repo-url" v-model="form.repo_url" type="url" required placeholder="https://github.com/organization/course.git"><label for="branch">发布分支</label><input id="branch" v-model="form.branch" required><label for="credential-ref">凭据引用（可选）</label><input id="credential-ref" v-model="form.credential_ref" placeholder="由部署管理员提供的引用名称"><p class="form-hint">私有仓库的只读凭据由部署环境配置，请勿在这里填写密码或访问令牌。</p><label class="checkbox-label"><input v-model="form.enabled" type="checkbox">启用此课程源</label></template>
    <template v-else-if="mode === 'options'"><label for="access-policy">谁可以访问</label><select id="access-policy" v-model="form.access_policy"><option value="authenticated">所有已登录成员</option><option value="restricted">仅指定成员</option></select><p class="form-hint">选择指定成员后，请通过列表中的“授权”操作配置成员。管理员始终可以访问。</p><label class="checkbox-label"><input v-model="form.featured" type="checkbox">优先推荐这门课程</label></template>
    <template v-else-if="mode === 'grants'"><p class="muted">此名单仅在课程设置为“仅指定成员”时生效。管理员不需要单独授权。</p><div class="grant-list"><label v-for="user in grantUsers.filter(u => u.role !== 'admin')" :key="user.id" class="grant-row"><input v-model="grantIds" type="checkbox" :value="user.id"><span><strong>{{ user.display_name }}</strong><small>{{ user.username }}{{ user.status === 'disabled' ? ' · 已停用' : '' }}</small></span></label><p v-if="!grantUsers.some(u => u.role !== 'admin')" class="muted">还没有学习成员，请先创建账号。</p></div></template>
    <template v-else-if="mode === 'reset'"><p class="muted">将撤销该成员的所有会话，并要求在下次登录时修改密码。</p><label for="reset-password">新的初始密码</label><input id="reset-password" v-model="form.password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"></template>
    <template v-else-if="mode === 'history'"><p v-if="!releases.length" class="empty-inline">尚无发布版本，请先同步课程。</p><article v-for="release in releases" :key="release.id" class="release-row"><div><strong>{{ release.title }}</strong><span v-if="release.id === selectedCourse?.current_release_id" class="badge good">当前</span><span v-if="release.revoked_at" class="badge neutral">已撤销</span><p>{{ dateText(release.created_at) }} · {{ release.source_kind === 'local-preview' ? '本地预览' : release.commit_sha.slice(0, 10) }}</p></div><div class="table-actions"><button v-if="release.id !== selectedCourse?.current_release_id && !release.revoked_at" type="button" class="text-button" @click="activate(release)">切换到此版本</button><button v-if="!release.revoked_at" type="button" class="text-button danger" @click="revoke(release)">撤销访问</button></div></article></template>
    <template v-else-if="mode === 'confirm'"><p class="confirmation-text">{{ confirmMessage }}</p><template v-if="needReason"><label for="reason">操作原因</label><input id="reason" v-model="reason" maxlength="500" required></template></template>
    <div v-if="mode !== 'history'" class="dialog-actions"><button type="button" class="button secondary" :disabled="busy" @click="open = false">取消</button><button class="button primary" :disabled="busy || (mode === 'grants' && !!dialogError)">{{ busy ? '正在保存…' : mode === 'confirm' ? '确认操作' : '保存' }}</button></div>
  </form></DialogPanel>
</template>
