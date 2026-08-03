import { ApiProperty } from '@nestjs/swagger';
export class RecommendationActionResultDto {
  @ApiProperty({ format: 'uuid' })
  taskId!: string;
}
