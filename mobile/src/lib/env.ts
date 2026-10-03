// Public values only (EXPO_PUBLIC_ is baked into the bundle). Never put a secret here.
function read(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy mobile/.env.example to mobile/.env and fill it in.`)
  return value
}

export const SUPABASE_URL = read('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL)
export const SUPABASE_PUBLISHABLE_KEY = read(
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)
export const API_URL = read('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/+$/, '')
