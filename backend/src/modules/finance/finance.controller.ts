import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateFinancialBudgetDto,
  CreateFinancialTransactionDto,
  FinanceOverviewQueryDto,
  FinanceOverviewResponseDto,
  FinancialBudgetResponseDto,
  FinancialTransactionResponseDto,
  ListFinancialTransactionsQueryDto,
  PaginatedFinancialTransactionsDto,
  UpdateFinancialBudgetDto,
  UpdateFinancialTransactionDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth('JWT')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.report.read')
  @ApiOperation({ summary: 'Get a cash-flow and budget overview' })
  @ApiOkResponse({ type: FinanceOverviewResponseDto })
  getOverview(@Query() query: FinanceOverviewQueryDto): Promise<FinanceOverviewResponseDto> {
    return this.financeService.getOverview(query.from, query.to);
  }

  @Post('transactions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.transaction.create')
  @ApiOperation({ summary: 'Create a financial transaction' })
  @ApiCreatedResponse({ type: FinancialTransactionResponseDto })
  createTransaction(
    @Body() dto: CreateFinancialTransactionDto,
  ): Promise<FinancialTransactionResponseDto> {
    return this.financeService.createTransaction(dto);
  }

  @Get('transactions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.transaction.read')
  @ApiOperation({ summary: 'List financial transactions' })
  findTransactions(
    @Query() query: ListFinancialTransactionsQueryDto,
  ): Promise<PaginatedFinancialTransactionsDto> {
    return this.financeService.findTransactions(query);
  }

  @Get('transactions/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.transaction.read')
  findTransaction(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FinancialTransactionResponseDto> {
    return this.financeService.findTransaction(id);
  }

  @Patch('transactions/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.transaction.update')
  updateTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialTransactionDto,
  ): Promise<FinancialTransactionResponseDto> {
    return this.financeService.updateTransaction(id, dto);
  }

  @Delete('transactions/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.transaction.delete')
  removeTransaction(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FinancialTransactionResponseDto> {
    return this.financeService.deleteTransaction(id);
  }

  @Post('budgets')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.budget.create')
  @ApiOperation({ summary: 'Create a financial budget' })
  @ApiCreatedResponse({ type: FinancialBudgetResponseDto })
  createBudget(@Body() dto: CreateFinancialBudgetDto): Promise<FinancialBudgetResponseDto> {
    return this.financeService.createBudget(dto);
  }

  @Get('budgets')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.budget.read')
  listBudgets(): Promise<FinancialBudgetResponseDto[]> {
    return this.financeService.listBudgets();
  }

  @Patch('budgets/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.budget.update')
  updateBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialBudgetDto,
  ): Promise<FinancialBudgetResponseDto> {
    return this.financeService.updateBudget(id, dto);
  }

  @Delete('budgets/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('finance.budget.delete')
  removeBudget(@Param('id', ParseUUIDPipe) id: string): Promise<FinancialBudgetResponseDto> {
    return this.financeService.deleteBudget(id);
  }
}
