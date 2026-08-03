import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { LivenessCheckDataDto, ReadinessCheckDataDto } from './dto/health-check.dto';
import { HealthService, LivenessCheckResult } from './health.service';

@ApiTags('System')
@Controller({ path: '', version: VERSION_NEUTRAL })
export class SystemHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('readiness')
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Application is ready to serve traffic',
    type: ReadinessCheckDataDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Application is not ready — a required dependency (database or Redis) is down. ' +
      'A degraded object store returns 200 with status "degraded".',
  })
  async readiness(@Res() response: Response): Promise<void> {
    const result = await this.healthService.readiness();
    // `degraded` must return 200: it means the service is serving correctly
    // while a non-essential dependency (object storage) is down. Returning
    // 503 here would let an orchestrator evict every healthy replica over an
    // attachment outage — silently inverting the degradable-storage decision
    // documented in deploy/STORAGE-READINESS.md.
    const status = result.status === 'not_ready' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    response.status(status).json(result);
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
