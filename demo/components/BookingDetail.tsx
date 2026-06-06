'use client'

import { trpc } from '@/lib/trpc'

interface BookingDetailProps {
  bookingId: string
}

export default function BookingDetail({ bookingId }: BookingDetailProps) {
  const { data: booking, isLoading } = trpc.booking.getById.useQuery({ id: bookingId })

  if (isLoading) return <div>Loading...</div>
  if (!booking) return <div>Booking not found</div>

  return (
    <div className="booking-detail">
      <h2>{booking.title}</h2>
      <p>{booking.description}</p>
      <span>Status: {booking.status}</span>
    </div>
  )
}
