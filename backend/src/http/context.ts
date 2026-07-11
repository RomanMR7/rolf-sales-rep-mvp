import type {
  EffectiveSessionDto,
  NavigationFlagsDto,
  PermissionsDto,
  UserDto,
} from '@rolf-sales-rep-mvp/contracts'

import type { AppEnv } from '../env'
import type { AuthService } from '../auth/service'
import type { StorageService } from '../storage/service'

export type AuthenticatedUserContext = UserDto & {
  sessionId: string
  realUser: UserDto
  effectiveUser: UserDto
  realUserId: string
  effectiveUserId: string
  realRole: UserDto['role']
  effectiveRole: UserDto['role']
  ownerMode: 'ROLE_PREVIEW' | 'USER_IMPERSONATION' | null
  permissions: PermissionsDto
  navigation: NavigationFlagsDto
  effectiveSession: EffectiveSessionDto
}

export type AppHonoVariables = {
  authService: AuthService
  env: AppEnv
  storageService: StorageService | null
}

export type AppHonoEnv = {
  Variables: AppHonoVariables
}

export type AuthenticatedHonoEnv = {
  Variables: AppHonoVariables & {
    user: AuthenticatedUserContext
  }
}

export function userDtoFromAuthenticatedUser(user: AuthenticatedUserContext): UserDto {
  return user.effectiveUser
}
