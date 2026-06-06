import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const bookingRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.booking.findMany({
      include: { user: true },
    })
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.booking.findUnique({
        where: { id: input.id },
        include: { user: true, comments: true },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string(),
      startTime: z.date(),
      endTime: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.booking.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.booking.update({
        where: { id },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.booking.delete({
        where: { id: input.id },
      })
    }),
})
