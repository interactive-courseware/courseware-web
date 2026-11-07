<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ArrowUpRight, BookOpen, Clock3, Layers3, Search, SlidersHorizontal, Sparkles, X } from 'lucide-vue-next'
import { api, auth, errorText, kindNames, type CourseCard, type Page } from '../api'

type LessonResult = { id: string; title: string; summary: string; kind: string; course_slug: string; course_title: string; url: string }
type Facets = { tags: {name: string; count: number}[]; creators: {id: string; name: string; count: number}[]; kinds: {name: string; count: number}[] }
const route = useRoute(), router = useRouter()
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const tag = ref(''), kind = ref(''), creator = ref(''), sort = ref('relevance'), mode = ref('course'), page = ref(1)
const items = ref<CourseCard[]>([]), lessonItems = ref<LessonResult[]>([]), total = ref(0), loading = ref(true), error = ref('')
const stats = ref({ course_count: 0, lesson_count: 0, creator_count: 0 })
const facets = ref<Facets>({ tags: [], creators: [], kinds: [] }), heroCourse = ref<CourseCard | null>(null)
const hasFilters = computed(() => Boolean(q.value || tag.value || kind.value || creator.value))
let timer: ReturnType<typeof setTimeout> | undefined, request = 0
async function load() {
  const id = ++request
  loading.value = true; error.value = ''
  const params = new URLSearchParams({ page: String(page.value), page_size: '12', q: q.value.trim(), sort: sort.value })
  if (tag.value) params.set('tag', tag.value)
  if (kind.value) params.set('kind', kind.value)
  if (creator.value) params.set('creator_id', creator.value)
  try {
    if (mode.value === 'lesson' && q.value.trim()) {
      params.set('type', 'lesson')
      const result = await api<Page<LessonResult>>(`/search?${params}`)
      if (id !== request) return
      lessonItems.value = result.items; total.value = result.total
    } else {
      const result = await api<Page<CourseCard>>(`/courses?${params}`)
      if (id !== request) return
      items.value = result.items; total.value = result.total
      if (!hasFilters.value && result.items[0]) heroCourse.value = result.items[0]
    }
    await router.replace({ query: q.value ? { q: q.value } : {} })
  } catch (e) { if (id === request) error.value = errorText(e) }
  finally { if (id === request) loading.value = false }
}
function clear() { q.value = ''; tag.value = ''; kind.value = ''; creator.value = ''; mode.value = 'course' }
watch([q, tag, kind, creator, sort, mode], () => {
  page.value = 1
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})
function goPage(value: number) { page.value = value; load() }
onMounted(async () => {
  load()
  try {
    const [s, f] = await Promise.all([api<typeof stats.value>('/catalog/stats'), api<Facets>('/catalog/facets')])
    stats.value = s; facets.value = f
  } catch (e) { error.value = errorText(e) }
})
onUnmounted(() => { clearTimeout(timer); request++ })
</script>

<template>
  <section class="catalog-hero"><div class="hero-copy"><p class="eyebrow"><span class="small-line"></span> LEARNING, REIMAGINED</p><h1>让知识，<br>在探索中<span>发生。</span></h1><p class="hero-description">每一门课程，都是一次新的发现。<br>从概念到实践，用交互打开理解的另一种可能。</p><div class="hero-stats"><div><strong>{{ stats.course_count.toString().padStart(2, '0') }}</strong><span>精选课程</span></div><i></i><div><strong>{{ stats.lesson_count.toString().padStart(2, '0') }}</strong><span>交互课时</span></div><i></i><div><strong>{{ stats.creator_count.toString().padStart(2, '0') }}</strong><span>内容创作者</span></div></div></div><div class="hero-visual"><div class="visual-orbit orbit-one"></div><div class="visual-orbit orbit-two"></div><span class="visual-plus">+</span><span class="visual-coordinate">x · y · possibility</span><div class="visual-grid"><span class="visual-curve"></span><span class="visual-node n-one"></span><span class="visual-node n-two"></span><span class="visual-node n-three"></span></div><div class="hero-note"><Sparkles :size="15" /><span>不只是学习，更是亲手发现。</span></div></div></section>
  <section class="catalog-section" aria-labelledby="catalog-title"><div class="section-heading"><div><p class="eyebrow">THE COURSE COLLECTION</p><h2 id="catalog-title">发现你的下一门课<span class="count-chip">{{ stats.course_count }}</span></h2></div><span class="section-aside">保持好奇，慢慢深入。<ArrowUpRight :size="15" /></span></div>
    <div class="catalog-toolbar"><div class="search-field"><Search :size="18" /><input v-model="q" aria-label="搜索课程、章节或制作人" maxlength="100" placeholder="搜索课程、章节、制作人…"><button v-if="q" class="icon-button" aria-label="清除搜索" @click="q = ''"><X :size="16" /></button><kbd v-else>搜索</kbd></div><label class="select-field"><SlidersHorizontal :size="16" /><span class="sr-only">排序方式</span><select v-model="sort"><option value="relevance">推荐排序</option><option value="published">最近发布</option><option value="title">课程名称</option></select></label></div>
    <div class="filter-row"><div class="tag-filters" aria-label="按标签筛选"><button :class="{ active: !tag }" @click="tag = ''; mode = 'course'">全部课程</button><button v-for="item in facets.tags" :key="item.name" :class="{ active: tag === item.name }" @click="tag = item.name; mode = 'course'">{{ item.name }}</button></div><div class="compact-filters"><select v-model="kind" aria-label="课时类型"><option value="">所有类型</option><option v-for="item in facets.kinds" :key="item.name" :value="item.name">{{ kindNames[item.name] || item.name }}</option></select><select v-model="creator" aria-label="制作人"><option value="">所有制作人</option><option v-for="item in facets.creators" :key="item.id" :value="item.id">{{ item.name }}</option></select></div></div>
    <div v-if="q" class="search-mode"><span>搜索范围</span><button :class="{ selected: mode === 'course' }" @click="mode = 'course'">课程</button><button :class="{ selected: mode === 'lesson' }" @click="mode = 'lesson'">已发布课时</button></div>
    <div v-if="error" class="alert error" role="alert">{{ error }}<button @click="load" class="text-button">重新加载</button></div>
    <div v-else-if="loading" class="course-grid" aria-busy="true" aria-label="正在加载课程"><div v-for="n in 3" :key="n" class="skeleton-card"><div></div><span></span><span></span></div></div>
    <div v-else-if="!total" class="empty-state"><Search :size="32" /><h3>{{ hasFilters ? '还没有找到匹配的内容' : '新的探索，正在准备中' }}</h3><p>{{ hasFilters ? '试试更短的关键词，或清除筛选条件。' : '课程发布后，就会出现在这里。' }}</p><button v-if="hasFilters" class="button secondary" @click="clear">清除筛选</button><RouterLink v-else-if="auth.user?.role === 'admin'" to="/admin/courses" class="button primary">管理课程 <ArrowRight :size="16" /></RouterLink></div>
    <div v-else-if="mode === 'lesson' && q" class="search-lessons"><a v-for="lesson in lessonItems" :key="lesson.course_slug + lesson.id" :href="lesson.url" class="search-lesson"><span class="lesson-icon"><BookOpen :size="20" /></span><div><span class="overline">{{ lesson.course_title }} · {{ kindNames[lesson.kind] }}</span><h3>{{ lesson.title }}</h3><p>{{ lesson.summary }}</p></div><ArrowUpRight :size="20" /></a></div>
    <div v-else class="course-grid"><RouterLink v-for="(course, index) in items" :key="course.id" :to="course.detail_url" class="course-card"><div class="course-art"><img :src="course.cover.url" :alt="course.cover.alt" :loading="index ? 'lazy' : 'eager'"><span class="course-level">{{ ({ introductory: '轻松入门', intermediate: '进阶探索', advanced: '深入研究' } as Record<string, string>)[course.level || ''] || '交互式课程' }}</span><span class="art-arrow"><ArrowUpRight :size="19" /></span></div><div class="course-card-body"><div class="card-tags"><span v-for="item in course.tags.slice(0, 2)" :key="item">{{ item }}</span></div><h3>{{ course.title }}</h3><p>{{ course.summary }}</p><div class="card-author"><span class="mini-avatar">{{ course.creators[0]?.name.slice(0, 1) }}</span><span>{{ course.creators.map(c => c.name).join(' · ') }}</span></div><div class="course-card-footer"><span><Layers3 :size="14" />{{ course.counts.lesson_count }} 个课时</span><span><Clock3 :size="14" />{{ course.counts.lessons_without_duration ? '自主探索' : course.counts.known_duration_minutes + ' 分钟' }}</span></div></div></RouterLink><div v-if="items.length < 3 && !hasFilters" class="collection-note"><span class="note-symbol">✳</span><p class="eyebrow">MADE FOR UNDERSTANDING</p><h3>慢一点，<br>理解深一点。</h3><p>好的学习，不是匆忙看完，<br>而是亲手试过，再多问一个为什么。</p><span class="collection-line"></span><RouterLink v-if="auth.user?.role === 'admin'" to="/admin/courses">带来一门新课程 <ArrowUpRight :size="15" /></RouterLink></div></div>
    <div v-if="!loading && total" class="pagination"><span>共 {{ total }} {{ mode === 'lesson' && q ? '个课时' : '门课程' }}</span><div><button class="button small secondary" :disabled="page === 1" @click="goPage(page - 1)">上一页</button><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span><button class="button small secondary" :disabled="page * 12 >= total" @click="goPage(page + 1)">下一页</button></div></div>
  </section>
</template>
