import { useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, TelegramAuthRequest } from '@rolf-sales-rep-mvp/contracts'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { ApiClient } from './api'
import {
  clearAuthenticatedSession,
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useTelegramAuthMutation,
} from './auth-queries'
import { AuthContext, type AuthContextValue } from './auth-context'
import { bootstrapAuthSession } from './bootstrap-auth'

const cachedMeKey = 'rolf:last_successful_me'

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const setAccessToken = useCallback(
    (nextAccessToken: string | null) => setAccessTokenState(nextAccessToken),
    [],
  )
  const handleAuthExpired = useCallback(() => {
    clearAuthenticatedSession(queryClient, setAccessToken)
  }, [queryClient, setAccessToken])

  const api = useMemo(
    () =>
      new ApiClient({
        getAccessToken: () => accessToken,
        setAccessToken,
        onAuthExpired: handleAuthExpired,
      }),
    [accessToken, handleAuthExpired, setAccessToken],
  )

  useEffect(() => {
    let isMounted = true
    const canBootstrapSession = import.meta.env.DEV || Boolean(window.Telegram?.WebApp)
    if (!canBootstrapSession) {
      setIsBootstrapping(false)
      return () => {
        isMounted = false
      }
    }

    const bootstrapApi = new ApiClient({
      getAccessToken: () => null,
      setAccessToken,
    })

    bootstrapAuthSession({
      api: bootstrapApi,
      shouldApply: () => isMounted,
      setAccessToken,
    })
      .then(() => {
        return undefined
      })
      .finally(() => {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [setAccessToken])

  const meQuery = useCurrentUserQuery({
    api,
    enabled: !isBootstrapping && Boolean(accessToken),
  })
  const cachedMe = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      return JSON.parse(window.localStorage.getItem(cachedMeKey) ?? 'null')
    } catch {
      return null
    }
  }, [])
  useEffect(() => {
    window.Telegram?.WebApp?.ready?.()
    window.Telegram?.WebApp?.expand?.()
  }, [])
  useEffect(() => {
    if (meQuery.data?.user) {
      window.localStorage.setItem(cachedMeKey, JSON.stringify(meQuery.data))
    }
  }, [meQuery.data])
  const { mutateAsync: registerAsync } = useRegisterMutation({ api, setAccessToken })
  const { mutateAsync: loginAsync } = useLoginMutation({ api, setAccessToken })
  const { mutateAsync: telegramAuthAsync } = useTelegramAuthMutation({ api, setAccessToken })
  const { mutateAsync: logoutAsync } = useLogoutMutation({ api, setAccessToken })

  const register = useCallback(
    async (input: RegisterRequest) => {
      await registerAsync(input)
    },
    [registerAsync],
  )

  const login = useCallback(
    async (input: LoginRequest) => {
      await loginAsync(input)
    },
    [loginAsync],
  )

  const telegramAuth = useCallback(
    async (input: TelegramAuthRequest) => {
      await telegramAuthAsync(input)
    },
    [telegramAuthAsync],
  )

  const logout = useCallback(async () => {
    await logoutAsync()
  }, [logoutAsync])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data?.user ?? cachedMe?.user ?? null,
      session: meQuery.data?.effectiveSession ?? cachedMe?.effectiveSession ?? null,
      permissions: meQuery.data?.permissions ?? cachedMe?.permissions ?? null,
      navigation: meQuery.data?.navigation ?? cachedMe?.navigation ?? null,
      isBootstrapping,
      isAuthenticated: Boolean(meQuery.data?.user),
      register,
      login,
      telegramAuth,
      logout,
      api,
    }),
    [api, cachedMe, isBootstrapping, login, logout, meQuery.data, register, telegramAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
