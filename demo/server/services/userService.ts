import { prisma } from '../db'

export function listUsers() {
  return prisma.user.findMany({ include: { profile: true } })
}
