import { SalesToolSourceService } from '../src/modules/sales/tools/sales-tool-source.service';
import { AITool, ToolExecutionContext } from '../src/modules/ai/tools/tool.interface';

function toolContext(): ToolExecutionContext {
  return { conversationId: 'conversation-1', signal: new AbortController().signal };
}

describe('SalesToolSourceService', () => {
  let toolRegistry: { registerDynamicSource: jest.Mock };
  let opportunitiesService: { create: jest.Mock; update: jest.Mock; findAll: jest.Mock };
  let activitiesService: { create: jest.Mock; update: jest.Mock; findAll: jest.Mock };
  let leadsService: { findAll: jest.Mock };
  let contactsService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let companiesService: { create: jest.Mock; update: jest.Mock };
  let notificationService: { create: jest.Mock };
  let tenantContextService: { getOrThrow: jest.Mock };
  let service: SalesToolSourceService;

  function findTool(name: string): AITool {
    const tool = service.listTools().find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() };
    opportunitiesService = { create: jest.fn(), update: jest.fn(), findAll: jest.fn() };
    activitiesService = { create: jest.fn(), update: jest.fn(), findAll: jest.fn() };
    leadsService = { findAll: jest.fn() };
    contactsService = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    companiesService = { create: jest.fn(), update: jest.fn() };
    notificationService = { create: jest.fn() };
    tenantContextService = { getOrThrow: jest.fn().mockReturnValue({ organizationId: 'org-1' }) };

    service = new SalesToolSourceService(
      toolRegistry as never,
      opportunitiesService as never,
      activitiesService as never,
      leadsService as never,
      contactsService as never,
      companiesService as never,
      notificationService as never,
      tenantContextService as never,
    );
  });

  it('registers itself as a dynamic tool source on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('exposes exactly the expected tool names', () => {
    const names = service.listTools().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_opportunities',
        'search_overdue_activities',
        'create_task',
        'search_leads',
        'create_contact',
        'update_contact',
        'delete_contact',
        'create_company',
        'update_company',
        'create_deal',
        'update_deal',
        'move_pipeline_stage',
        'assign_task',
        'add_note',
        'send_notification',
      ]),
    );
  });

  describe('create_contact', () => {
    it('creates a contact and returns its id', async () => {
      contactsService.create.mockResolvedValue({
        id: 'c1',
        firstName: 'Taylor',
        lastName: 'Morgan',
      });
      const result = await findTool('create_contact').execute(
        { firstName: 'Taylor', lastName: 'Morgan' },
        toolContext(),
      );
      expect(contactsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Taylor', lastName: 'Morgan' }),
      );
      expect(result).toEqual({ id: 'c1', firstName: 'Taylor', lastName: 'Morgan' });
    });

    it('rejects a missing firstName/lastName', async () => {
      await expect(
        findTool('create_contact').execute({ firstName: '', lastName: 'Morgan' }, toolContext()),
      ).rejects.toThrow('firstName and lastName are required');
      expect(contactsService.create).not.toHaveBeenCalled();
    });
  });

  describe('update_contact', () => {
    it('updates by contactId and strips it from the update payload', async () => {
      contactsService.update.mockResolvedValue({
        id: 'c1',
        firstName: 'Jamie',
        lastName: 'Morgan',
      });
      await findTool('update_contact').execute(
        { contactId: 'c1', firstName: 'Jamie' },
        toolContext(),
      );
      expect(contactsService.update).toHaveBeenCalledWith('c1', { firstName: 'Jamie' });
    });
  });

  describe('delete_contact', () => {
    it('deletes a contact by id', async () => {
      contactsService.remove.mockResolvedValue({ id: 'c1' });
      const result = await findTool('delete_contact').execute({ contactId: 'c1' }, toolContext());
      expect(contactsService.remove).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ id: 'c1', deleted: true });
    });
  });

  describe('create_company / update_company', () => {
    it('creates a company', async () => {
      companiesService.create.mockResolvedValue({ id: 'co1', name: 'Acme' });
      const result = await findTool('create_company').execute({ name: 'Acme' }, toolContext());
      expect(companiesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme' }),
      );
      expect(result).toEqual({ id: 'co1', name: 'Acme' });
    });

    it('rejects a missing name', async () => {
      await expect(findTool('create_company').execute({ name: '' }, toolContext())).rejects.toThrow(
        'name is required',
      );
    });

    it('updates a company by companyId', async () => {
      companiesService.update.mockResolvedValue({ id: 'co1', name: 'Acme Energy' });
      await findTool('update_company').execute(
        { companyId: 'co1', name: 'Acme Energy' },
        toolContext(),
      );
      expect(companiesService.update).toHaveBeenCalledWith('co1', { name: 'Acme Energy' });
    });
  });

  describe('create_deal / update_deal / move_pipeline_stage', () => {
    it('creates a deal with a valid stage', async () => {
      opportunitiesService.create.mockResolvedValue({
        id: 'o1',
        title: 'Big Deal',
        stage: 'DISCOVERY',
      });
      const result = await findTool('create_deal').execute(
        { title: 'Big Deal', stage: 'DISCOVERY' },
        toolContext(),
      );
      expect(opportunitiesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Big Deal', stage: 'DISCOVERY' }),
      );
      expect(result).toEqual({ id: 'o1', title: 'Big Deal', stage: 'DISCOVERY' });
    });

    it('rejects an invalid stage on create', async () => {
      await expect(
        findTool('create_deal').execute({ title: 'Big Deal', stage: 'BOGUS' }, toolContext()),
      ).rejects.toThrow('stage must be one of');
      expect(opportunitiesService.create).not.toHaveBeenCalled();
    });

    it('updates a deal by dealId', async () => {
      opportunitiesService.update.mockResolvedValue({
        id: 'o1',
        title: 'New Title',
        stage: 'PROPOSAL',
      });
      await findTool('update_deal').execute({ dealId: 'o1', title: 'New Title' }, toolContext());
      expect(opportunitiesService.update).toHaveBeenCalledWith('o1', { title: 'New Title' });
    });

    it('moves a deal to a new pipeline stage', async () => {
      opportunitiesService.update.mockResolvedValue({ id: 'o1', stage: 'NEGOTIATION' });
      const result = await findTool('move_pipeline_stage').execute(
        { dealId: 'o1', stage: 'NEGOTIATION' },
        toolContext(),
      );
      expect(opportunitiesService.update).toHaveBeenCalledWith('o1', { stage: 'NEGOTIATION' });
      expect(result).toEqual({ id: 'o1', stage: 'NEGOTIATION' });
    });

    it('rejects an invalid stage on move_pipeline_stage', async () => {
      await expect(
        findTool('move_pipeline_stage').execute({ dealId: 'o1', stage: 'BOGUS' }, toolContext()),
      ).rejects.toThrow('stage must be one of');
    });
  });

  describe('assign_task', () => {
    it('stores the assignee on the activity metadata', async () => {
      activitiesService.update.mockResolvedValue({ id: 't1', subject: 'Follow up' });
      const result = await findTool('assign_task').execute(
        { taskId: 't1', assigneeUserId: 'user-1' },
        toolContext(),
      );
      expect(activitiesService.update).toHaveBeenCalledWith('t1', {
        metadata: { assigneeUserId: 'user-1' },
      });
      expect(result).toEqual({ id: 't1', subject: 'Follow up' });
    });
  });

  describe('add_note', () => {
    it('creates a NOTE-type activity linked to the given entity', async () => {
      activitiesService.create.mockResolvedValue({ id: 'n1', subject: 'Customer prefers email' });
      await findTool('add_note').execute(
        { note: 'Customer prefers email contact.', opportunityId: 'o1' },
        toolContext(),
      );
      expect(activitiesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOTE',
          description: 'Customer prefers email contact.',
          opportunityId: 'o1',
        }),
      );
    });

    it('rejects an empty note', async () => {
      await expect(findTool('add_note').execute({ note: '' }, toolContext())).rejects.toThrow(
        'note is required',
      );
    });
  });

  describe('send_notification', () => {
    it('resolves organizationId from tenant context and creates a real notification', async () => {
      notificationService.create.mockResolvedValue({ id: 'notif-1' });
      const result = await findTool('send_notification').execute(
        { userId: 'user-1', title: 'Deal at risk', body: 'Check on it' },
        toolContext(),
      );
      expect(tenantContextService.getOrThrow).toHaveBeenCalled();
      expect(notificationService.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        category: 'CRM',
        title: 'Deal at risk',
        body: 'Check on it',
        actionUrl: undefined,
      });
      expect(result).toEqual({ id: 'notif-1' });
    });

    it('rejects a missing userId/title', async () => {
      await expect(
        findTool('send_notification').execute({ userId: '', title: 'x' }, toolContext()),
      ).rejects.toThrow('userId and title are required');
    });
  });
});
