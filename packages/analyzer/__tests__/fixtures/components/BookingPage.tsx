import { BookingList } from './BookingList'
import { BookingForm } from './BookingForm'

export function BookingPage() {
  return (
    <div>
      <h1>Bookings</h1>
      <BookingList />
      <BookingForm />
    </div>
  )
}
