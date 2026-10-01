// The one place the browser talks to our backend.
export async function apiGet(path) {
  const response = await fetch(`/api${path}`)
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  return response.json()
}
