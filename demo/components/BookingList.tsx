'use client'

import { useEffect, useState } from 'react'

interface BookingSummary {
  id: string
  title: string
  description?: string | null
}

export default function BookingList() {
  const [bookings, setBookings] = useState<BookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/booking')
      .then(response => response.json())
      .then(setBookings)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="booking-list">
      {bookings.map((booking) => (
        <div key={booking.id} className="booking-card">
          <h3>{booking.title}</h3>
          <p>{booking.description}</p>
        </div>
      ))}
    </div>
  )
}
