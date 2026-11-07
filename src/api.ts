import { reactive } from 'vue'
import type { components } from './api.generated'

export type CourseCard = components['schemas']['CourseCard']
export type CourseDetail = components['schemas']['CourseDetail']
export type User = components['schemas']['UserView']
export type AuthResponse = components['schemas']['AuthView']
export type Page<T> = { items: T[]; total: number; page: number; page_size: number }
export type Job = { id: string; status: string; stage: string; error_message: string | null; created_at: string }
export type Source = { repo_url: string; branch: string; credential_ref: string | null; enabled: boolean }
export type AdminCourse = {
  id: string; slug: string; title: string; listing_status: string; access_policy: string;
  current_release_id: string | null; source: Source | null; latest_job: Job | null; featured: boolean
}
export type Release = { id: string; title: string; commit_sha: string; created_at: string; revoked_at: string | null; source_kind: string }
export const auth = reactive({ user: null as User | null, csrf: '', ready: false })

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', auth.csrf)
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'same-origin' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 401 && !path.startsWith('/auth/')) {
      auth.user = null
      window.dispatchEvent(new Event('courseware:session-ended'))
    }
    throw new ApiError(response.status, body.error?.code || 'REQUEST_FAILED', body.error?.message || '暂时无法完成操作，请稍后重试')
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function errorText(error: unknown) { return error instanceof Error ? error.message : '操作失败，请稍后重试' }
export function dateText(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value)) : '尚未发布'
}
export const kindNames: Record<string, string> = { theory: '理论课', lab: '交互实验', project: '项目实践', reading: '阅读' }

export async function loadAuth() {
  try {
    const result = await api<AuthResponse>('/auth/me')
    auth.user = result.user; auth.csrf = result.csrf_token
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error
    auth.user = null
  }
  auth.ready = true
}

export async function signIn(username: string, password: string) {
  auth.csrf = (await api<{ csrf_token: string }>('/auth/csrf')).csrf_token
  const result = await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  auth.user = result.user; auth.csrf = result.csrf_token; auth.ready = true
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' })
  auth.user = null; auth.csrf = ''
}
