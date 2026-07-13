import { prisma } from '../db'

export function listBookings() {
  return prisma.booking.findMany({ include: { user: true } })
}

export function createBooking(data: Parameters<typeof prisma.booking.create>[0]['data']) {
  return prisma.booking.create({ data })
}
