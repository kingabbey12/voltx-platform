import { ApiProperty } from '@nestjs/swagger';
import { ExecutiveContext } from './context.types';

export class ExecutiveContextResponseDto implements ExecutiveContext {
  @ApiProperty()
  organization!: { id: string };

  @ApiProperty()
  user!: { id: string };

  @ApiProperty()
  crm!: ExecutiveContext['crm'];

  @ApiProperty()
  finance!: ExecutiveContext['finance'];

  @ApiProperty()
  operations!: ExecutiveContext['operations'];

  @ApiProperty()
  communications!: ExecutiveContext['communications'];

  @ApiProperty()
  notifications!: ExecutiveContext['notifications'];

  @ApiProperty()
  calendar!: ExecutiveContext['calendar'];

  @ApiProperty()
  metadata!: ExecutiveContext['metadata'];
}
