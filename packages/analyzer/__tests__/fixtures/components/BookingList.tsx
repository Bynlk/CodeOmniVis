import { trpc } from '../utils/trpc'

export function BookingList() {
  const { data: bookings } = trpc.booking.list.useQuery()

  const handleCreate = async () => {
    await fetch('/api/booking', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Booking' }),
    })
  }

  return (
    <div>
      {bookings?.map(b => <div key={b.id}>{b.title}</div>)}
      <button onClick={handleCreate}>Create</button>
    </div>
  )
}
