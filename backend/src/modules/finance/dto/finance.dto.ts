import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  FinancialBudgetEntity,
  FinanceOverviewEntity,
  FinancialTransactionEntity,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '../entities/finance.entity';

const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
const TRANSACTION_STATUSES = ['PENDING', 'POSTED', 'VOID'] as const;

export class CreateFinancialTransactionDto {
  @ApiProperty({ enum: TRANSACTION_TYPES, example: 'EXPENSE' })
  @IsEnum(TRANSACTION_TYPES)
  type!: FinancialTransactionType;

  @ApiPropertyOptional({ enum: TRANSACTION_STATUSES, default: 'POSTED' })
  @IsOptional()
  @IsEnum(TRANSACTION_STATUSES)
  status?: FinancialTransactionStatus;

  @ApiProperty({ example: 'Software' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 249.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiProperty({ example: '2026-08-02T00:00:00.000Z' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ example: 'Figma' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterpartyName?: string;

  @ApiPropertyOptional({ example: 'August design subscription' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'INV-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}

export class UpdateFinancialTransactionDto extends PartialType(CreateFinancialTransactionDto) {}

export class ListFinancialTransactionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsEnum(TRANSACTION_TYPES)
  type?: FinancialTransactionType;

  @ApiPropertyOptional({ enum: TRANSACTION_STATUSES })
  @IsOptional()
  @IsEnum(TRANSACTION_STATUSES)
  status?: FinancialTransactionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateFinancialBudgetDto {
  @ApiProperty({ example: 'Q3 operating expenses' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional({ example: 'Software' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}

export class UpdateFinancialBudgetDto extends PartialType(CreateFinancialBudgetDto) {}

export class FinanceOverviewQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class FinancialTransactionResponseDto {
  id!: string;
  type!: FinancialTransactionType;
  status!: FinancialTransactionStatus;
  category!: string;
  amount!: number;
  currency!: string;
  occurredAt!: string;
  costCenterId!: string | null;
  counterpartyName!: string | null;
  description!: string | null;
  externalReference!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: FinancialTransactionEntity): FinancialTransactionResponseDto {
    return Object.assign(new FinancialTransactionResponseDto(), {
      ...entity,
      occurredAt: entity.occurredAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    });
  }
}

export class FinancialBudgetResponseDto {
  id!: string;
  name!: string;
  category!: string | null;
  amount!: number;
  currency!: string;
  periodStart!: string;
  periodEnd!: string;
  costCenterId!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: FinancialBudgetEntity): FinancialBudgetResponseDto {
    return Object.assign(new FinancialBudgetResponseDto(), {
      ...entity,
      periodStart: entity.periodStart.toISOString(),
      periodEnd: entity.periodEnd.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    });
  }
}

export class FinanceOverviewResponseDto {
  periodStart!: string;
  periodEnd!: string;
  currency!: string;
  income!: number;
  expenses!: number;
  netCashFlow!: number;
  pendingExpenses!: number;
  budgetedExpenses!: number;
  budgetVariance!: number;

  static fromEntity(entity: FinanceOverviewEntity): FinanceOverviewResponseDto {
    return Object.assign(new FinanceOverviewResponseDto(), {
      ...entity,
      periodStart: entity.periodStart.toISOString(),
      periodEnd: entity.periodEnd.toISOString(),
    });
  }
}

export class PaginatedFinancialTransactionsDto {
  @ApiProperty({ type: [FinancialTransactionResponseDto] })
  items!: FinancialTransactionResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class FinancialTransactionSuccessResponseDto extends ApiSuccessResponseDto<FinancialTransactionResponseDto> {}
export class FinancialBudgetSuccessResponseDto extends ApiSuccessResponseDto<FinancialBudgetResponseDto> {}
export class FinanceOverviewSuccessResponseDto extends ApiSuccessResponseDto<FinanceOverviewResponseDto> {}
export class PaginatedFinancialTransactionsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedFinancialTransactionsDto> {}
