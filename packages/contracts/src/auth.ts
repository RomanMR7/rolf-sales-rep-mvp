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
  role: z.enum(['ADMIN', 'MANAGER', 'SALES_REP']),
  telegramId: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  telegramFirstName: z.string().nullable(),
  telegramLastName: z.string().nullable(),
  createdAt: z.string().datetime(),
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
})

export type UserDto = z.infer<typeof userSchema>
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
