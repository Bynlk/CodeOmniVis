import { Controller, Get, Post } from '@nestjs/common'

@Controller('api/orders')
export class OrdersController {
  @Get(':id')
  findOne(): void {}

  @Post()
  create(): void {}
}
