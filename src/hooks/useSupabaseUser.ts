import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

export function useSupabaseUser() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded) {
      setLoading(false)
    }
  }, [isLoaded])

  return {
    clerkUser,
    loading,
    isAuthenticated: isSignedIn && !!clerkUser,
    clerkUserId: clerkUser?.id || null
  }
} 