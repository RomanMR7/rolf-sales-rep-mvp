import { z } from 'zod'

const displayNameSchema = z
  .union([z.string().trim().min(2).max(80), z.literal('')])
  .optional()
  .transform((value) => {
    if (value === '' || value === undefined) return undefined
    return value
  })

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')

export const userSchema = z.object({
  id: z.string(),
  email: emailSchema,
  displayName: z.string().nullable(),
  role: z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER']),
  status: z.enum(['ACTIVE', 'BLOCKED', 'INVITED', 'DISABLED']),
  telegramId: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  telegramFirstName: z.string().nullable(),
  telegramLastName: z.string().nullable(),
  telegramPhotoUrl: z.string().nullable(),
  supervisorId: z.string().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'])

export const effectiveSessionSchema = z.object({
  mode: z.enum(['ROLE_PREVIEW', 'USER_IMPERSONATION']).nullable(),
  realUser: userSchema,
  effectiveUser: userSchema,
  realRole: roleSchema,
  effectiveRole: roleSchema,
  isActive: z.boolean(),
})

export const permissionsSchema = z.object({
  usersManage: z.boolean(),
  functionsManage: z.boolean(),
  scriptsManage: z.boolean(),
  metricsView: z.boolean(),
  leadsManage: z.boolean(),
  leadsView: z.boolean(),
})

export const navigationFlagsSchema = z.object({
  owner: z.boolean(),
  dashboard: z.boolean(),
  leads: z.boolean(),
  managers: z.boolean(),
  metrics: z.boolean(),
  functions: z.boolean(),
  scripts: z.boolean(),
  settings: z.boolean(),
})

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
})

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const refreshRequestSchema = z
  .object({
    refreshToken: z.string().min(32).optional(),
  })
  .optional()
  .default({})

export const logoutRequestSchema = z
  .object({
    refreshToken: z.string().min(32).optional(),
  })
  .optional()
  .default({})

export const telegramDevUserSchema = z.object({
  telegramId: z.string().trim().min(1).max(64),
  username: z.string().trim().min(1).max(64).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
})

export const telegramAuthRequestSchema = z
  .object({
    initData: z.string().min(1).optional(),
    devUser: telegramDevUserSchema.optional(),
  })
  .refine((value) => Boolean(value.initData) || Boolean(value.devUser), {
    message: 'initData or devUser is required',
  })

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
})

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
})

export const meResponseSchema = z.object({
  user: userSchema,
  permissions: permissionsSchema.optional(),
  navigation: navigationFlagsSchema.optional(),
  effectiveSession: effectiveSessionSchema.optional(),
})

export type UserDto = z.infer<typeof userSchema>
export type EffectiveSessionDto = z.infer<typeof effectiveSessionSchema>
export type PermissionsDto = z.infer<typeof permissionsSchema>
export type NavigationFlagsDto = z.infer<typeof navigationFlagsSchema>
export type RegisterRequest = z.input<typeof registerRequestSchema>
export type RegisterPayload = z.output<typeof registerRequestSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type RefreshRequest = z.infer<typeof refreshRequestSchema>
export type LogoutRequest = z.infer<typeof logoutRequestSchema>
export type TelegramDevUser = z.infer<typeof telegramDevUserSchema>
export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
export type RefreshResponse = z.infer<typeof refreshResponseSchema>
export type MeResponse = z.infer<typeof meResponseSchema>
