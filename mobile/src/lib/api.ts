// The one place the app talks to our backend: the same FastAPI endpoints the website uses.
import { API_URL } from './env'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail: string | null = null,
  ) {
    super(message)
  }
}

type Options = { auth?: boolean }

async function send(method: string, path: string, body: unknown, token: string | null) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// With `auth: true` the signed-in user's token is attached. If the server says it is no good, the
// session is refreshed once and the call retried; if that fails too, this device signs out locally.
async function request<T>(method: string, path: string, body?: unknown, { auth = false }: Options = {}): Promise<T> {
  let token: string | null = null
  if (auth) {
    token = (await supabase.auth.getSession()).data.session?.access_token ?? null
    if (!token) throw new ApiError(401, 'Not signed in')
  }

  let response = await send(method, path, body, token)
  if (auth && response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    const fresh = error ? null : data.session?.access_token ?? null
    if (fresh) response = await send(method, path, body, fresh)
    if (!fresh || response.status === 401) await supabase.auth.signOut({ scope: 'local' })
  }

  if (!response.ok) {
    let detail: string | null = null
    try {
      const problem = await response.json()
      if (typeof problem.detail === 'string') detail = problem.detail
    } catch {
      // No readable body: the status alone will do.
    }
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`, detail)
  }
  return response.json() as Promise<T>
}

export const apiGet = <T>(path: string, options?: Options) => request<T>('GET', path, undefined, options)
export const apiPost = <T>(path: string, body: unknown, options?: Options) => request<T>('POST', path, body, options)
export const apiPatch = <T>(path: string, body: unknown, options?: Options) => request<T>('PATCH', path, body, options)
export const apiDelete = <T>(path: string, options?: Options) => request<T>('DELETE', path, undefined, options)
