export const productionApiFallbackUrl = 'https://rolf-sales-rep-mvp-backend.onrender.com'

type ApiBaseResolution = {
  urls: string[]
  reason: string
}

export function resolveApiBaseUrls(envApiUrl: unknown, fallbackUrl = productionApiFallbackUrl): ApiBaseResolution {
  const fallback = normalizeApiBaseUrl(fallbackUrl) ?? productionApiFallbackUrl
  const configured = normalizeApiBaseUrl(envApiUrl)

  if (configured) {
    return {
      urls: configured === fallback ? [configured] : [configured, fallback],
      reason: 'VITE_API_URL is configured',
    }
  }

  return {
    urls: [fallback],
    reason: 'VITE_API_URL is missing or invalid; using production fallback',
  }
}

export function normalizeApiBaseUrl(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    url.search = ''
    return url.href.replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function logApiBaseSelection(urls: string[], reason: string) {
  if (typeof console === 'undefined') return

  console.info('[api] API base selection', {
    primary: urls[0],
    fallbacks: urls.slice(1),
    reason,
  })
}
