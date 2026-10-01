import { useEffect } from 'react'

import useAuth from '../hooks/useAuth.js'
import { startBagSync } from '../lib/bagSync.js'

// Renders nothing; it only keeps the bag in step with the signed-in user's saved bag.
export default function BagSync() {
  const { user, loading } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (loading) return undefined
    return startBagSync(userId)
  }, [userId, loading])

  return null
}
