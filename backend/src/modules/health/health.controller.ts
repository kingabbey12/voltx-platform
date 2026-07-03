import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { HealthCheckDataDto } from './dto/health-check.dto';
import { HealthCheckResult, HealthService } from './health.service';

class HealthCheckResponseDto extends ApiSuccessResponseDto<HealthCheckDataDto> {}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check application health' })
  @ApiOkResponse({
    description: 'Application is healthy',
    type: HealthCheckResponseDto,
  })
  check(): HealthCheckResult {
    return this.healthService.check();
  }
}
