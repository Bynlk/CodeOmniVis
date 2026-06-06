import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const bookings = await prisma.booking.findMany()
  return NextResponse.json(bookings)
}

export async function POST(request: Request) {
  const body = await request.json()
  const booking = await prisma.booking.create({ data: body })
  return NextResponse.json(booking)
}
