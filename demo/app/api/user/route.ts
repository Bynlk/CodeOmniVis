import { NextResponse } from 'next/server'
import { listUsers } from '../../../server/services/userService'

export async function GET() {
  const users = await listUsers()
  return NextResponse.json(users)
}
