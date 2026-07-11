import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowDefinitionValidatorService } from './definition/workflow-definition-validator.service';
import { WorkflowEntity } from './entities/workflow.entity';
import { WorkflowTemplateEntity } from './entities/workflow-template.entity';
import {
  CreateWorkflowTemplateData,
  FindWorkflowTemplatesParams,
  PaginatedWorkflowTemplates,
  WorkflowTemplateRepository,
} from './workflow-template.repository';
import { WorkflowService } from './workflow.service';

@Injectable()
export class WorkflowTemplateService {
  constructor(
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
    private readonly workflowDefinitionValidatorService: WorkflowDefinitionValidatorService,
    private readonly workflowService: WorkflowService,
  ) {}

  async create(data: CreateWorkflowTemplateData): Promise<WorkflowTemplateEntity> {
    this.workflowDefinitionValidatorService.validate(data.definition);
    return this.workflowTemplateRepository.create(data);
  }

  async list(params: FindWorkflowTemplatesParams): Promise<PaginatedWorkflowTemplates> {
    return this.workflowTemplateRepository.findAll(params);
  }

  async getByKey(key: string): Promise<WorkflowTemplateEntity> {
    const template = await this.workflowTemplateRepository.findByKey(key);
    if (!template) {
      throw new NotFoundException(`Workflow template "${key}" not found`);
    }
    return template;
  }

  /** Creates a real Workflow (a first draft version) from the template's definition — not a parallel execution path. */
  async instantiate(key: string, name?: string): Promise<WorkflowEntity> {
    const template = await this.getByKey(key);
    return this.workflowService.createWorkflow({
      name: name ?? template.name,
      description: template.description ?? undefined,
      definition: template.definition,
    });
  }

  async remove(id: string): Promise<WorkflowTemplateEntity> {
    const removed = await this.workflowTemplateRepository.softDelete(id);
    if (!removed) {
      throw new NotFoundException('Workflow template not found (or is a system template)');
    }
    return removed;
  }
}
