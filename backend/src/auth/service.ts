import type {
  LoginRequest,
  RegisterPayload,
  UserDto,
} from '@rolf-sales-rep-mvp/contracts'
import { randomBytes } from 'node:crypto'

import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { AppError } from '../http/errors'
import type { AuthenticatedUserContext } from '../http/context'
import { userDtoFromAuthenticatedUser } from '../http/context'
import { Prisma, UserRole } from '../generated/prisma/client'
import { navigationForRole, permissionsForRole, type Role } from './middleware'
import { signAccessToken, verifyAccessToken } from './access-tokens'
import { hashPassword, verifyPassword } from './passwords'
import { createRefreshToken, hashRefreshToken } from './refresh-tokens'
import type { TelegramUserProfile } from './telegram'

type SessionMetadata = {
  userAgent?: string
  ipAddress?: string
}

type UserRecord = {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  status: 'ACTIVE' | 'BLOCKED' | 'INVITED' | 'DISABLED'
  telegramId: string | null
  telegramUsername: string | null
  telegramFirstName: string | null
  telegramLastName: string | null
  telegramPhotoUrl: string | null
  supervisorId: string | null
  lastSeenAt: Date | null
  createdAt: Date
}

type SessionRecord = {
  id: string
  ownerMode: 'ROLE_PREVIEW' | 'USER_IMPERSONATION' | null
  effectiveRole: UserRole | null
  effectiveUser: UserRecord | null
  user: UserRecord
}

export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly env: AppEnv,
  ) {}

  async register(input: RegisterPayload, metadata: SessionMetadata) {
    const existingUser = await this.db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    })

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'User with this email already exists')
    }

    const passwordHash = await hashPassword(input.password)

    const user = await this.db.user
      .create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw new AppError(409, 'CONFLICT', 'User with this email already exists')
        }

        throw error
      })

    return this.issueSession(user, metadata)
  }

  async login(input: LoginRequest, metadata: SessionMetadata) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    })

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash)
    if (!passwordMatches) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
    }

    return this.issueSession(user, metadata)
  }

  async loginWithTelegram(profile: TelegramUserProfile, metadata: SessionMetadata) {
    const displayName = displayNameFromTelegramProfile(profile)
    const telegramData = {
      telegramUsername: profile.username,
      telegramFirstName: profile.firstName,
      telegramLastName: profile.lastName,
      telegramPhotoUrl: profile.photoUrl,
      lastSeenAt: new Date(),
      ...(displayName ? { displayName } : {}),
    }

    const existingUser = await this.db.user.findUnique({
      where: { telegramId: profile.telegramId },
    })

    if (existingUser) {
      if (existingUser.status === 'BLOCKED' || existingUser.status === 'DISABLED') {
        throw new AppError(403, 'FORBIDDEN', 'This Telegram user is not allowed to access the app')
      }
      const user = await this.db.user.update({
        where: { id: existingUser.id },
        data: telegramData,
      })
      return this.issueSession(user, metadata)
    }

    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'))
    const user = await this.db.user
      .create({
        data: {
          email: telegramEmail(profile.telegramId),
          passwordHash,
          displayName,
          role: this.env.ADMIN_TELEGRAM_IDS.includes(profile.telegramId) ? UserRole.OWNER : UserRole.VIEWER,
          status: this.env.ADMIN_TELEGRAM_IDS.includes(profile.telegramId) ? 'ACTIVE' : 'INVITED',
          telegramId: profile.telegramId,
          telegramUsername: profile.username,
          telegramFirstName: profile.firstName,
          telegramLastName: profile.lastName,
          telegramPhotoUrl: profile.photoUrl,
          lastSeenAt: new Date(),
        },
      })
      .catch((error: unknown) => {
        if (!isUniqueConstraintError(error)) throw error
        throw new AppError(409, 'CONFLICT', 'Telegram user already exists')
      })

    return this.issueSession(user, metadata)
  }

  async refresh(refreshToken: string | undefined, metadata: SessionMetadata) {
    if (!refreshToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Refresh token is required')
    }

    const refreshTokenHash = hashRefreshToken(refreshToken)
    const now = new Date()
    const currentSession = await this.db.authSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      include: { user: true, effectiveUser: true },
    })

    if (!currentSession) {
      throw new AppError(401, 'UNAUTHORIZED', 'Refresh session is invalid or expired')
    }

    const nextRefreshToken = createRefreshToken()
    const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken)
    const expiresAt = this.refreshExpiresAt()

    const nextSession = await this.db.$transaction(async (tx) => {
      const revokeResult = await tx.authSession.updateMany({
        where: {
          id: currentSession.id,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: { revokedAt: now },
      })

      if (revokeResult.count !== 1) {
        throw new AppError(401, 'UNAUTHORIZED', 'Refresh session is invalid or expired')
      }

      return tx.authSession.create({
        data: {
          userId: currentSession.userId,
          refreshTokenHash: nextRefreshTokenHash,
          expiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
      })
    })

    const accessToken = await signAccessToken(
      {
        sub: currentSession.user.id,
        email: currentSession.user.email,
        sessionId: nextSession.id,
      },
      this.env,
    )

    return {
      accessToken,
      refreshToken: nextRefreshToken,
    }
  }

  async authenticateAccessToken(accessToken: string | undefined): Promise<AuthenticatedUserContext> {
    if (!accessToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token is required')
    }

    const payload = await verifyAccessToken(accessToken, this.env).catch(() => {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token is invalid or expired')
    })

    const session = await this.db.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: { user: true, effectiveUser: true },
    })

    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Session is invalid or expired')
    }

    return authenticatedContextFromSession(session)
  }

  async getMe(accessToken: string | undefined) {
    const user = await this.authenticateAccessToken(accessToken)

    return mePayload(user)
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return

    await this.db.authSession.updateMany({
      where: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  private async issueSession(user: UserRecord, metadata: SessionMetadata) {
    const refreshToken = createRefreshToken()
    const session = await this.db.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiresAt(),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    })

    const accessToken = await signAccessToken(
      {
        sub: user.id,
        email: user.email,
        sessionId: session.id,
      },
      this.env,
    )

    return {
      user: toUserDto(user),
      accessToken,
      refreshToken,
    }
  }

  private refreshExpiresAt() {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: publicRole(user.role),
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    telegramFirstName: user.telegramFirstName,
    telegramLastName: user.telegramLastName,
    telegramPhotoUrl: user.telegramPhotoUrl,
    status: user.status,
    supervisorId: user.supervisorId,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

export function mePayload(user: AuthenticatedUserContext) {
  return {
    user: userDtoFromAuthenticatedUser(user),
    permissions: user.permissions,
    navigation: user.navigation,
    effectiveSession: user.effectiveSession,
  }
}

function displayNameFromTelegramProfile(profile: TelegramUserProfile) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || null
}

function telegramEmail(telegramId: string) {
  return `telegram-${telegramId}@telegram.rolf-sales-rep-mvp.local`
}

function publicRole(role: UserRole) {
  return role === UserRole.SALES_REP ? UserRole.MANAGER : role
}

function authenticatedContextFromSession(session: SessionRecord): AuthenticatedUserContext {
  const realUser = toUserDto(session.user)
  const effectiveUserRecord = session.ownerMode === 'USER_IMPERSONATION' && session.effectiveUser
    ? session.effectiveUser
    : session.user
  const effectiveUserBase = toUserDto(effectiveUserRecord)
  const effectiveRole = publicRole(
    session.ownerMode === 'ROLE_PREVIEW' && session.effectiveRole
      ? session.effectiveRole
      : effectiveUserRecord.role,
  ) as Role
  const effectiveUser = {
    ...effectiveUserBase,
    role: effectiveRole,
  }
  const realRole = realUser.role as Role
  const permissions = permissionsForRole(effectiveRole)
  const navigation = navigationForRole(effectiveRole)
  const effectiveSession = {
    mode: session.ownerMode,
    realUser,
    effectiveUser,
    realRole,
    effectiveRole,
    isActive: Boolean(session.ownerMode),
  }

  return {
    ...effectiveUser,
    sessionId: session.id,
    realUser,
    effectiveUser,
    realUserId: realUser.id,
    effectiveUserId: effectiveUser.id,
    realRole,
    effectiveRole,
    ownerMode: session.ownerMode,
    permissions,
    navigation,
    effectiveSession,
  }
}
