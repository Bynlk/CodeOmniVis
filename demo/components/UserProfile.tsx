'use client'

import { trpc } from '@/lib/trpc'

export default function UserProfile() {
  const { data: user, isLoading } = trpc.user.me.useQuery()

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}
