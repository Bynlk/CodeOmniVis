'use client'

import { useEffect, useState } from 'react'

interface UserSummary {
  id: string
  name?: string | null
  email: string
}

export default function UserProfile() {
  const [user, setUser] = useState<UserSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user')
      .then(response => response.json())
      .then((users: UserSummary[]) => setUser(users[0] ?? null))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}
