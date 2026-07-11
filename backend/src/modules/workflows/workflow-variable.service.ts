import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowVariableEntity } from './entities/workflow-variable.entity';
import {
  CreateWorkflowVariableData,
  UpdateWorkflowVariableData,
  WorkflowVariableRepository,
} from './workflow-variable.repository';

@Injectable()
export class WorkflowVariableService {
  constructor(private readonly workflowVariableRepository: WorkflowVariableRepository) {}

  async create(data: CreateWorkflowVariableData): Promise<WorkflowVariableEntity> {
    return this.workflowVariableRepository.create(data);
  }

  /** workflowId: null lists only org-level shared variables; a workflow id lists that workflow's own variables plus every org-level one. */
  async list(workflowId: string | null): Promise<WorkflowVariableEntity[]> {
    return this.workflowVariableRepository.listForWorkflow(workflowId);
  }

  async update(id: string, data: UpdateWorkflowVariableData): Promise<WorkflowVariableEntity> {
    const updated = await this.workflowVariableRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException('Workflow variable not found');
    }
    return updated;
  }

  async remove(id: string): Promise<WorkflowVariableEntity> {
    const removed = await this.workflowVariableRepository.remove(id);
    if (!removed) {
      throw new NotFoundException('Workflow variable not found');
    }
    return removed;
  }
}
