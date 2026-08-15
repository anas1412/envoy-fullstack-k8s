import { Controller, Get } from '@nestjs/common'

@Controller('healthz')
export class LivenessController {
  @Get()
  check() {
    return { status: 'ok' }
  }
}
