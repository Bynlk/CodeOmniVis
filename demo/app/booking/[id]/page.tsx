import BookingDetail from '@/components/BookingDetail'

interface BookingDetailPageProps {
  params: { id: string }
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  return <BookingDetail bookingId={params.id} />
}
