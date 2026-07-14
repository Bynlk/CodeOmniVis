import type { Response } from 'express'

export function sendInternalError(
  response: Response,
  logMessage: string,
  publicMessage: string,
  error: unknown,
): void {
  console.error(`${logMessage}:`, error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: publicMessage },
  })
}
