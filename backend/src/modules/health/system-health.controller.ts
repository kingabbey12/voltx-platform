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
    description: 'Application is not ready — a required dependency is down',
  })
  async readiness(@Res() response: Response): Promise<void> {
    const result = await this.healthService.readiness();
    const status = result.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
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
