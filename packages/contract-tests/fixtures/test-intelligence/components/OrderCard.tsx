export interface OrderCardProps {
  orderId: string
}

export function OrderCard({ orderId }: OrderCardProps) {
  return <article data-order-id={orderId}>{orderId}</article>
}
