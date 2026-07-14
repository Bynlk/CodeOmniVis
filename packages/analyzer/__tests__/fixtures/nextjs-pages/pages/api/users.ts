export default function handler(req: { method?: string }) {
  if (req.method === 'POST') return 'created'
  if (req.method === 'DELETE') return 'deleted'
  return 'ok'
}
