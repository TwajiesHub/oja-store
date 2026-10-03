import { API_URL } from './env'

// Product photos come from the API as paths on the website (/images/...). Used from T2.
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
