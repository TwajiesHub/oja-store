// The one place the browser talks to our backend.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function apiGet(path) {
  const response = await fetch(`/api${path}`)
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed with ${response.status}`)
  }
  return response.json()
}
