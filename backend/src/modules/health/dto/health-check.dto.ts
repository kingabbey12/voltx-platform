import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckDataDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 123.456, description: 'Process uptime in seconds' })
  uptime!: number;
}
