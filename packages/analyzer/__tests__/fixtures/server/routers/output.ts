import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'

export const outputRouter = createTRPCRouter({
  health: publicProcedure
    .output(z.string())
    .query(() => 'ok'),
})
