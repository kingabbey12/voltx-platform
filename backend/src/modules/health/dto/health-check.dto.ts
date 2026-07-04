import { ApiProperty } from '@nestjs/swagger';

export class HealthDependencyDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ example: 12 })
  latencyMs!: number;
}

export class HealthCheckDataDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 123.456, description: 'Process uptime in seconds' })
  uptime!: number;

  @ApiProperty({ type: HealthDependencyDto })
  dependencies!: {
    database: HealthDependencyDto;
  };
}

export class ReadinessCheckDataDto {
  @ApiProperty({ example: 'ready', enum: ['ready', 'not_ready'] })
  status!: 'ready' | 'not_ready';

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ type: HealthDependencyDto })
  dependencies!: {
    database: HealthDependencyDto;
  };
}

export class LivenessCheckDataDto {
  @ApiProperty({ example: 'alive', enum: ['alive'] })
  status!: 'alive';

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 123.456, description: 'Process uptime in seconds' })
  uptime!: number;
}
