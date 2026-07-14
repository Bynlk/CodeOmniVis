import { Router } from 'express'

const router = Router()
router.use('/v1')
router.get('/', () => undefined)
router.post('/orders', () => undefined)

const app = Router()
app.patch('/health', () => undefined)
