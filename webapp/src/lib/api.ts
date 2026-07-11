import {
  apiErrorSchema,
  authResponseSchema,
  clientPointInputSchema,
  clientResponseSchema,
  dashboardResponseSchema,
  listClientsResponseSchema,
  listOrdersResponseSchema,
  listProductCategoriesResponseSchema,
  listProductsResponseSchema,
  listVisitsResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  orderInputSchema,
  orderPatchSchema,
  orderResponseSchema,
  productInputSchema,
  productResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  telegramAuthRequestSchema,
  visitInputSchema,
  visitResponseSchema,
  type AuthResponse,
  type ClientPointInput,
  type LoginRequest,
  type LogoutRequest,
  type MeResponse,
  type OrderInput,
  type OrderPatch,
  type ProductInput,
  type RefreshRequest,
  type RefreshResponse,
  type RegisterRequest,
  type TelegramAuthRequest,
  type VisitInput,
} from '@rolf-sales-rep-mvp/contracts'
import { z } from 'zod'

import {
  logApiBaseSelection,
  normalizeApiBaseUrl,
  resolveApiBaseUrls,
} from './apiConfig'

type ApiClientOptions = {
  apiBaseUrl?: string
  fallbackApiBaseUrl?: string
  getAccessToken: () => string | null
  setAccessToken: (accessToken: string | null) => void
  onAuthExpired?: () => void | Promise<void>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  retryOnUnauthorized?: boolean
  accessTokenOverride?: string
  timeoutMs?: number
}

const defaultRequestTimeoutMs = 12000
const telegramAuthColdStartTimeoutMs = 90000

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class ApiClient {
  private readonly options: ApiClientOptions
  private refreshPromise: Promise<RefreshResponse> | null = null
  private activeApiBaseUrl: string | null = null
  private readonly configuredApiBaseUrls: string[]

  constructor(options: ApiClientOptions) {
    this.options = options
    const resolved = resolveApiBaseUrls(
      options.apiBaseUrl ?? import.meta.env?.VITE_API_URL,
      options.fallbackApiBaseUrl,
    )
    this.configuredApiBaseUrls = resolved.urls
    logApiBaseSelection(this.configuredApiBaseUrls, resolved.reason)
  }

  register(input: RegisterRequest): Promise<AuthResponse> {
    const payload = registerRequestSchema.parse(input)
    return this.request('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  login(input: LoginRequest): Promise<AuthResponse> {
    const payload = loginRequestSchema.parse(input)
    return this.request('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  telegramAuth(input: TelegramAuthRequest): Promise<AuthResponse> {
    const payload = telegramAuthRequestSchema.parse(input)
    return this.request('/api/auth/telegram', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      timeoutMs: telegramAuthColdStartTimeoutMs,
    })
  }

  refresh(input: RefreshRequest = {}): Promise<RefreshResponse> {
    const payload = refreshRequestSchema.parse(input)
    return this.request('/api/auth/refresh', refreshResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  me(): Promise<MeResponse> {
    return this.request('/api/auth/me', meResponseSchema, {
      auth: true,
    })
  }

  async logout(input: LogoutRequest = {}) {
    const payload = logoutRequestSchema.parse(input)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  async expireSession() {
    this.options.setAccessToken(null)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: {},
      auth: false,
      retryOnUnauthorized: false,
    }).catch(() => undefined)
    await this.options.onAuthExpired?.()
  }

  dashboard() {
    return this.request('/api/dashboard', dashboardResponseSchema, { auth: true })
  }

  clients(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return this.request(`/api/clients${query}`, listClientsResponseSchema, { auth: true })
  }

  createClient(input: ClientPointInput) {
    return this.request('/api/clients', clientResponseSchema, {
      method: 'POST',
      body: clientPointInputSchema.parse(input),
      auth: true,
    })
  }

  productCategories() {
    return this.request('/api/product-categories', listProductCategoriesResponseSchema, { auth: true })
  }

  products(search?: string, categoryId?: string) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (categoryId) params.set('categoryId', categoryId)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return this.request(`/api/products${query}`, listProductsResponseSchema, { auth: true })
  }

  createProduct(input: ProductInput) {
    return this.request('/api/products', productResponseSchema, {
      method: 'POST',
      body: productInputSchema.parse(input),
      auth: true,
    })
  }

  visits(today = false) {
    return this.request(today ? '/api/visits/today' : '/api/visits', listVisitsResponseSchema, { auth: true })
  }

  createVisit(input: VisitInput) {
    return this.request('/api/visits', visitResponseSchema, {
      method: 'POST',
      body: visitInputSchema.parse(input),
      auth: true,
    })
  }

  visitAction(id: string, action: 'start' | 'complete' | 'skip') {
    return this.request(`/api/visits/${id}/${action}`, visitResponseSchema, {
      method: 'POST',
      body: {},
      auth: true,
    })
  }

  orders() {
    return this.request('/api/orders', listOrdersResponseSchema, { auth: true })
  }

  createOrder(input: OrderInput) {
    return this.request('/api/orders', orderResponseSchema, {
      method: 'POST',
      body: orderInputSchema.parse(input),
      auth: true,
    })
  }

  updateOrder(id: string, input: OrderPatch) {
    return this.request(`/api/orders/${id}`, orderResponseSchema, {
      method: 'PATCH',
      body: orderPatchSchema.parse(input),
      auth: true,
    })
  }

  orderAction(id: string, action: 'submit' | 'approve' | 'reject' | 'cancel', body: { managerComment?: string } = {}) {
    return this.request(`/api/orders/${id}/${action}`, orderResponseSchema, {
      method: 'POST',
      body,
      auth: true,
    })
  }

  adminUsers() {
    return this.request('/api/admin/users', z.object({ users: z.array(z.any()) }), { auth: true })
  }

  createAdminUser(input: unknown) {
    return this.request('/api/admin/users', z.object({ user: z.any() }), {
      method: 'POST',
      body: input,
      auth: true,
    })
  }

  updateAdminUser(id: string, input: unknown) {
    return this.request(`/api/admin/users/${id}`, z.object({ user: z.any() }), {
      method: 'PATCH',
      body: input,
      auth: true,
    })
  }

  updateAdminUserRole(id: string, role: string) {
    return this.request(`/api/admin/users/${id}/role`, z.object({ user: z.any() }), {
      method: 'PATCH',
      body: { role },
      auth: true,
    })
  }

  updateAdminUserStatus(id: string, status: string) {
    return this.request(`/api/admin/users/${id}/status`, z.object({ user: z.any() }), {
      method: 'PATCH',
      body: { status },
      auth: true,
    })
  }

  adminManagers() {
    return this.request('/api/admin/managers', z.object({ managers: z.array(z.any()) }), { auth: true })
  }

  adminManagerMetrics(id: string, params = '') {
    return this.request(`/api/admin/managers/${id}/metrics${params}`, z.object({ metrics: z.array(z.any()) }), { auth: true })
  }

  adminFunctions() {
    return this.request('/api/admin/functions', z.object({ functions: z.array(z.any()) }), { auth: true })
  }

  updateAdminFunction(key: string, input: unknown) {
    return this.request(`/api/admin/functions/${key}`, z.object({ function: z.any() }), {
      method: 'PATCH',
      body: input,
      auth: true,
    })
  }

  adminScripts() {
    return this.request('/api/admin/scripts', z.object({ scripts: z.array(z.any()) }), { auth: true })
  }

  createAdminScript(input: unknown) {
    return this.request('/api/admin/scripts', z.object({ script: z.any() }), {
      method: 'POST',
      body: input,
      auth: true,
    })
  }

  updateAdminScript(id: string, input: unknown) {
    return this.request(`/api/admin/scripts/${id}`, z.object({ script: z.any() }), {
      method: 'PATCH',
      body: input,
      auth: true,
    })
  }

  adminMetricsOverview(params = '') {
    return this.request(`/api/admin/metrics/overview${params}`, z.object({ metrics: z.any() }), { auth: true })
  }

  adminMetricsManagers(params = '') {
    return this.request(`/api/admin/metrics/managers${params}`, z.object({ managers: z.array(z.any()) }), { auth: true })
  }

  adminActivityLog() {
    return this.request('/api/admin/activity-log', z.object({ logs: z.array(z.any()) }), { auth: true })
  }

  appBootstrap() {
    return this.request('/api/app/bootstrap', z.any(), { auth: true })
  }

  ownerEffectiveSession() {
    return this.request('/api/owner/effective-session', z.object({ effectiveSession: z.any() }), { auth: true })
  }

  ownerPreviewRole(role: string) {
    return this.request('/api/owner/preview-role', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: { role },
      auth: true,
    })
  }

  ownerImpersonate(userId: string) {
    return this.request('/api/owner/impersonate', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: { userId },
      auth: true,
    })
  }

  ownerStopImpersonation() {
    return this.request('/api/owner/impersonation/stop', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: {},
      auth: true,
    })
  }

  adminManualMetricEntry(input: unknown) {
    return this.request('/api/admin/metrics/manual-entry', z.object({ metric: z.any() }), {
      method: 'POST',
      body: input,
      auth: true,
    })
  }

  leads() {
    return this.request('/api/leads', z.object({ leads: z.array(z.any()) }), { auth: true })
  }

  createLead(input: unknown) {
    return this.request('/api/leads', z.object({ lead: z.any() }), {
      method: 'POST',
      body: input,
      auth: true,
    })
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.infer<TSchema>> {
    const response = await this.rawRequest(path, options)
    const data = await response.json()
    return schema.parse(data)
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const checkedUrls = this.requestBaseUrls()
    let lastNetworkError: unknown = null
    let response: Response | null = null

    for (const baseUrl of checkedUrls) {
      const controller = new AbortController()
      const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? defaultRequestTimeoutMs)
      try {
        response = await fetch(`${baseUrl}${path}`, {
          method: options.method ?? 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: this.headers(options),
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        })
        this.activeApiBaseUrl = baseUrl
        break
      } catch (error) {
        lastNetworkError = error
        console.warn('[api] API request failed; trying next base URL if available', {
          baseUrl,
          path,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        globalThis.clearTimeout(timeout)
      }
    }

    if (!response) {
      throw new ApiRequestError(
        0,
        'BACKEND_UNREACHABLE',
        `Backend is unreachable. Checked: ${checkedUrls.join(', ')}`,
      )
    }

    if (lastNetworkError && this.activeApiBaseUrl) {
      console.info('[api] API base selected after retry', {
        baseUrl: this.activeApiBaseUrl,
      })
    }

    if (response.status === 401 && options.auth && options.retryOnUnauthorized !== false) {
      const refreshed = await this.refreshOnce().catch(async (error: unknown) => {
        await this.expireSession()
        throw error
      })
      this.options.setAccessToken(refreshed.accessToken)
      return this.rawRequest(path, {
        ...options,
        accessTokenOverride: refreshed.accessToken,
        retryOnUnauthorized: false,
      })
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    return response
  }

  private requestBaseUrls() {
    const urls = this.activeApiBaseUrl
      ? [this.activeApiBaseUrl, ...this.configuredApiBaseUrls]
      : this.configuredApiBaseUrls

    const normalizedUrls = urls
      .map((url) => normalizeApiBaseUrl(url))
      .filter((url): url is string => url !== null)

    return [...new Set(normalizedUrls)]
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  private headers(options: RequestOptions) {
    const headers = new Headers({
      'X-Client-Platform': 'web',
    })

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (options.auth) {
      const accessToken = options.accessTokenOverride ?? this.options.getAccessToken()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
    }

    return headers
  }
}

async function toApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`

  try {
    const parsed = apiErrorSchema.parse(await response.json())
    return new ApiRequestError(response.status, parsed.error.code, parsed.error.message)
  } catch {
    return new ApiRequestError(response.status, 'INTERNAL_ERROR', fallbackMessage)
  }
}
