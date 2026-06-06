'use client'

import { trpc } from '@/lib/trpc'

export default function BookingList() {
  const { data: bookings, isLoading } = trpc.booking.list.useQuery()

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="booking-list">
      {bookings?.map((booking) => (
        <div key={booking.id} className="booking-card">
          <h3>{booking.title}</h3>
          <p>{booking.description}</p>
        </div>
      ))}
    </div>
  )
}
