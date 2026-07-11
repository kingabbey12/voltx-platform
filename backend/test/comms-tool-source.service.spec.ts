import { CommsToolSourceService } from '../src/modules/communications/tools/comms-tool-source.service';
import { AITool, ToolExecutionContext } from '../src/modules/ai/tools/tool.interface';

function toolContext(): ToolExecutionContext {
  return { conversationId: 'conversation-1', signal: new AbortController().signal };
}

describe('CommsToolSourceService', () => {
  let toolRegistry: { registerDynamicSource: jest.Mock };
  let conversationService: { getConversationOrThrow: jest.Mock; sendMessage: jest.Mock };
  let messageRepository: { findByConversation: jest.Mock };
  let summaryRepository: { findLatest: jest.Mock; create: jest.Mock };
  let commsAiService: { summarizeConversation: jest.Mock; runPrompt: jest.Mock };
  let contactsService: { create: jest.Mock };
  let tenantContextService: { getOrThrow: jest.Mock };
  let channelConnectionRepository: { findAll: jest.Mock };
  let conversationRepository: {
    findByConnectionAndExternalThreadUnscoped: jest.Mock;
    create: jest.Mock;
  };
  let service: CommsToolSourceService;

  function findTool(name: string): AITool {
    const tool = service.listTools().find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() };
    conversationService = { getConversationOrThrow: jest.fn(), sendMessage: jest.fn() };
    messageRepository = { findByConversation: jest.fn().mockResolvedValue({ items: [] }) };
    summaryRepository = { findLatest: jest.fn(), create: jest.fn() };
    commsAiService = { summarizeConversation: jest.fn(), runPrompt: jest.fn() };
    contactsService = { create: jest.fn() };
    tenantContextService = {
      getOrThrow: jest.fn().mockReturnValue({ organizationId: 'org-1', userId: 'user-1' }),
    };
    channelConnectionRepository = { findAll: jest.fn() };
    conversationRepository = {
      findByConnectionAndExternalThreadUnscoped: jest.fn(),
      create: jest.fn(),
    };

    service = new CommsToolSourceService(
      toolRegistry as never,
      conversationService as never,
      messageRepository as never,
      summaryRepository as never,
      commsAiService as never,
      contactsService as never,
      tenantContextService as never,
      channelConnectionRepository as never,
      conversationRepository as never,
    );
  });

  it('registers itself as a dynamic tool source on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('exposes the new send tools alongside the existing summarize/draft/extract tools', () => {
    const names = service.listTools().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'comms_summarize_conversation',
        'comms_draft_reply',
        'comms_extract_contact_info',
        'comms_send_reply',
        'send_whatsapp_message',
        'send_sms_message',
      ]),
    );
  });

  describe('comms_send_reply', () => {
    it('sends a real reply into the given conversation as the current tenant user', async () => {
      conversationService.sendMessage.mockResolvedValue({ id: 'msg-1', status: 'SENT' });
      const result = await findTool('comms_send_reply').execute(
        { conversationId: 'conv-1', body: 'Thanks for reaching out!' },
        toolContext(),
      );
      expect(conversationService.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        body: 'Thanks for reaching out!',
        senderId: 'user-1',
      });
      expect(result).toEqual({ id: 'msg-1', status: 'SENT' });
    });

    it('rejects an empty body', async () => {
      await expect(
        findTool('comms_send_reply').execute({ conversationId: 'conv-1', body: '' }, toolContext()),
      ).rejects.toThrow('body is required');
    });
  });

  describe('send_whatsapp_message', () => {
    it('reuses an existing conversation for the phone number when one exists', async () => {
      channelConnectionRepository.findAll.mockResolvedValue({ items: [{ id: 'conn-1' }] });
      conversationRepository.findByConnectionAndExternalThreadUnscoped.mockResolvedValue({
        id: 'conv-existing',
      });
      conversationService.sendMessage.mockResolvedValue({ id: 'msg-1', status: 'QUEUED' });

      const result = await findTool('send_whatsapp_message').execute(
        { to: '+15551234567', body: 'Your order shipped!' },
        toolContext(),
      );

      expect(channelConnectionRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 1,
        channel: 'WHATSAPP',
        status: 'CONNECTED',
      });
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(conversationService.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-existing',
        body: 'Your order shipped!',
        senderId: 'user-1',
      });
      expect(result).toEqual({ id: 'msg-1', conversationId: 'conv-existing', status: 'QUEUED' });
    });

    it('creates a new conversation when none exists for the phone number', async () => {
      channelConnectionRepository.findAll.mockResolvedValue({ items: [{ id: 'conn-1' }] });
      conversationRepository.findByConnectionAndExternalThreadUnscoped.mockResolvedValue(null);
      conversationRepository.create.mockResolvedValue({ id: 'conv-new' });
      conversationService.sendMessage.mockResolvedValue({ id: 'msg-1', status: 'QUEUED' });

      await findTool('send_whatsapp_message').execute(
        { to: '+15559876543', body: 'Hello!' },
        toolContext(),
      );

      expect(conversationRepository.create).toHaveBeenCalledWith({
        connectionId: 'conn-1',
        channel: 'WHATSAPP',
        externalThreadId: '+15559876543',
      });
      expect(conversationService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-new' }),
      );
    });

    it('throws when the organization has no connected WhatsApp connection', async () => {
      channelConnectionRepository.findAll.mockResolvedValue({ items: [] });
      await expect(
        findTool('send_whatsapp_message').execute(
          { to: '+15551234567', body: 'Hi' },
          toolContext(),
        ),
      ).rejects.toThrow('No connected WHATSAPP connection');
    });
  });

  describe('send_sms_message', () => {
    it('resolves the TWILIO_SMS connection rather than WhatsApp', async () => {
      channelConnectionRepository.findAll.mockResolvedValue({ items: [{ id: 'conn-sms' }] });
      conversationRepository.findByConnectionAndExternalThreadUnscoped.mockResolvedValue({
        id: 'conv-sms-1',
      });
      conversationService.sendMessage.mockResolvedValue({ id: 'msg-1', status: 'QUEUED' });

      await findTool('send_sms_message').execute(
        { to: '+15551234567', body: 'Reminder: appointment tomorrow' },
        toolContext(),
      );

      expect(channelConnectionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'TWILIO_SMS' }),
      );
    });
  });
});
