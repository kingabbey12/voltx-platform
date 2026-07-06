import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  GraphTraversalNode,
  KnowledgeEntityType,
  KnowledgeRelationshipType,
} from '../entities/knowledge-graph.entity';

const KNOWLEDGE_ENTITY_TYPES: KnowledgeEntityType[] = [
  'PERSON',
  'COMPANY',
  'DEAL',
  'PROJECT',
  'TASK',
  'MEETING',
  'DOCUMENT',
  'EMAIL',
  'FILE',
  'NOTE',
  'AGENT',
  'WORKFLOW',
  'MEMORY',
];

const KNOWLEDGE_RELATIONSHIP_TYPES: KnowledgeRelationshipType[] = [
  'OWNS',
  'WORKS_AT',
  'ASSOCIATED_WITH',
  'PARTICIPATED_IN',
  'ASSIGNED_TO',
  'MENTIONS',
  'ATTACHED_TO',
  'RELATED_TO',
  'CREATED_BY',
];

class KnowledgeGraphEntityRefDto {
  @ApiProperty({ enum: KNOWLEDGE_ENTITY_TYPES })
  @IsIn(KNOWLEDGE_ENTITY_TYPES)
  type!: KnowledgeEntityType;

  @ApiPropertyOptional({ example: 'sf-contact-001' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label!: string;
}

export class LinkKnowledgeEntitiesDto {
  @ApiProperty({ type: KnowledgeGraphEntityRefDto })
  @IsObject()
  from!: KnowledgeGraphEntityRefDto;

  @ApiProperty({ type: KnowledgeGraphEntityRefDto })
  @IsObject()
  to!: KnowledgeGraphEntityRefDto;

  @ApiProperty({ enum: KNOWLEDGE_RELATIONSHIP_TYPES })
  @IsIn(KNOWLEDGE_RELATIONSHIP_TYPES)
  relationship!: KnowledgeRelationshipType;
}

export class TraverseKnowledgeGraphQueryDto {
  @ApiProperty({ enum: KNOWLEDGE_ENTITY_TYPES })
  @IsIn(KNOWLEDGE_ENTITY_TYPES)
  type!: KnowledgeEntityType;

  @ApiProperty({ example: 'sf-contact-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalId!: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  hops?: number = 1;
}

export class KnowledgeGraphNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: KNOWLEDGE_ENTITY_TYPES }) type!: KnowledgeEntityType;
  @ApiPropertyOptional() externalId!: string | null;
  @ApiProperty() label!: string;
  @ApiProperty() depth!: number;
  @ApiPropertyOptional({ enum: KNOWLEDGE_RELATIONSHIP_TYPES })
  viaRelationship!: KnowledgeRelationshipType | null;

  static fromNode(node: GraphTraversalNode): KnowledgeGraphNodeDto {
    const dto = new KnowledgeGraphNodeDto();
    dto.id = node.entity.id;
    dto.type = node.entity.type;
    dto.externalId = node.entity.externalId;
    dto.label = node.entity.label;
    dto.depth = node.depth;
    dto.viaRelationship = node.viaRelationship;
    return dto;
  }
}

export class KnowledgeGraphNodesSuccessResponseDto extends ApiSuccessResponseDto<
  KnowledgeGraphNodeDto[]
> {}
