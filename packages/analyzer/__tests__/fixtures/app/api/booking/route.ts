export async function GET() {
  return Response.json({ bookings: [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  return Response.json({ created: true })
}
