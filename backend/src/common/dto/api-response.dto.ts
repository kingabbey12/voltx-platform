import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseMetaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  requestId!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'v1' })
  version!: string;
}

export class ApiSuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  data!: T;

  @ApiProperty({ type: ApiResponseMetaDto })
  meta!: ApiResponseMetaDto;
}
