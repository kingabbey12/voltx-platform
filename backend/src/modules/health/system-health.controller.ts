import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { LivenessCheckDataDto, ReadinessCheckDataDto } from './dto/health-check.dto';
import { HealthService, LivenessCheckResult, ReadinessCheckResult } from './health.service';

@ApiTags('System')
@Controller({ path: '', version: VERSION_NEUTRAL })
export class SystemHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('readiness')
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Application readiness state',
    type: ReadinessCheckDataDto,
  })
  readiness(): Promise<ReadinessCheckResult> {
    return this.healthService.readiness();
  }

  @Get('liveness')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'Application liveness state',
    type: LivenessCheckDataDto,
  })
  liveness(): LivenessCheckResult {
    return this.healthService.liveness();
  }
}
