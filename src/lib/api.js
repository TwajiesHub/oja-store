// The one place the browser talks to our backend.
import { getAccessToken, getLatestAccessToken, refreshAccessToken, signOutOfSupabase } from './supabase.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
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
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`)
  }
  return response.json()
}

// For a page that is being hidden or closed. `keepalive` lets the browser finish the request after
// the page is gone. It cannot wait for a refreshed token, so it uses the latest one it has.
export function apiPutOnExit(path, body) {
  const token = getLatestAccessToken()
  if (!token) return
  fetch(`/api${path}`, {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => {})
}

export const apiGet = (path, options) => request('GET', path, undefined, options)
export const apiPost = (path, body, options) => request('POST', path, body, options)
export const apiPut = (path, body, options) => request('PUT', path, body, options)
