import { createContext } from 'react'
import type {
  LoginRequest,
  MeResponse,
  RegisterRequest,
  TelegramAuthRequest,
  UserDto,
} from '@rolf-sales-rep-mvp/contracts'
import type { ApiClient } from './api'

export type AuthContextValue = {
  user: UserDto | null
  session: MeResponse['effectiveSession'] | null
  permissions: MeResponse['permissions'] | null
  navigation: MeResponse['navigation'] | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  register: (input: RegisterRequest) => Promise<void>
  login: (input: LoginRequest) => Promise<void>
  telegramAuth: (input: TelegramAuthRequest) => Promise<void>
  logout: () => Promise<void>
  api: ApiClient
}

export const AuthContext = createContext<AuthContextValue | null>(null)
