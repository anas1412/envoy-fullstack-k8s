import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { LivenessController } from './liveness.controller'

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, LivenessController],
})
export class HealthModule {}
