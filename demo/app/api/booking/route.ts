import { NextResponse } from 'next/server'
import { createBooking, listBookings } from '../../../server/services/bookingService'

export async function GET() {
  const bookings = await listBookings()
  return NextResponse.json(bookings)
}

export async function POST(request: Request) {
  const body = await request.json()
  const booking = await createBooking(body)
  return NextResponse.json(booking)
}
