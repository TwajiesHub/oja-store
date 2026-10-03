// The one place the browser talks to our backend.
import { getAccessToken, refreshAccessToken, signOutOfSupabase } from './supabase.js'

// `detail` is the server's message for the shopper (a 409 or 502). `fieldErrors` maps a form
// field to its message when the server rejected a value (a 422).
export class ApiError extends Error {
  constructor(status, message, { detail = null, fieldErrors = {} } = {}) {
    super(message)
    this.status = status
    this.detail = detail
    this.fieldErrors = fieldErrors
  }
}

function send(method, path, body, token) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function readProblem(response) {
  const problem = { detail: null, fieldErrors: {} }
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') problem.detail = body.detail
    if (Array.isArray(body.detail)) {
      for (const item of body.detail) {
        const field = item.loc?.[item.loc.length - 1]
        if (typeof field === 'string') problem.fieldErrors[field] = String(item.msg).replace(/^Value error, /, '')
      }
    }
  } catch {
    // No readable body: the status alone will do.
  }
  return problem
}

// With `auth: true` the signed-in user's token is attached. If the server says it is no good,
// the session is refreshed once and the call retried; if that fails too, the user is signed out.
async function request(method, path, body, { auth = false } = {}) {
  let token = null
  if (auth) {
    token = await getAccessToken()
    if (!token) throw new ApiError(401, 'Not signed in')
  }

  let response = await send(method, path, body, token)
  if (auth && response.status === 401) {
    const fresh = await refreshAccessToken()
    if (fresh) response = await send(method, path, body, fresh)
    if (!fresh || response.status === 401) await signOutOfSupabase()
  }

  if (!response.ok) {
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`, await readProblem(response))
  }
  return response.json()
}

export const apiGet = (path, options) => request('GET', path, undefined, options)
export const apiPost = (path, body, options) => request('POST', path, body, options)
export const apiPatch = (path, body, options) => request('PATCH', path, body, options)
export const apiDelete = (path, options) => request('DELETE', path, undefined, options)
