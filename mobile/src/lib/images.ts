import { API_URL } from './env'

// Product photos come from the API as paths on the website (/images/...), so they are prefixed
// with the API address. Photos are stored as one 800px card file; the larger file for the product
// page has the same name with -large before .webp.
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

export function largeImageUrl(path: string | null | undefined): string | null {
  return imageUrl(path ? path.replace(/\.webp$/, '-large.webp') : path)
}

export const CARD_RATIO = 800 / 993
export const LARGE_RATIO = 928 / 1152
