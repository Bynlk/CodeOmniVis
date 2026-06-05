import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'

export const bookingRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.booking.findMany()
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) => {
      return ctx.prisma.booking.findUnique({
        where: { id: input.id },
      })
    }),

  create: publicProcedure
    .input(z.object({
      title: z.string(),
      startTime: z.date(),
    }))
    .mutation(({ input, ctx }) => {
      return ctx.prisma.booking.create({
        data: input,
      })
    }),
})
