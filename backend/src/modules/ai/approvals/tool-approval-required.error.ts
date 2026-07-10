/**
 * Thrown by AiGatewayService.executeTool() instead of running the tool
 * when it requires human approval and none has been decided yet. Caught
 * specifically by AgentLoopService (not treated as a generic tool
 * failure) so the run pauses to WAITING_APPROVAL rather than feeding back
 * an error observation to the model.
 */
export class ToolApprovalRequiredError extends Error {
  constructor(
    public readonly approvalId: string,
    public readonly toolName: string,
  ) {
    super(`Tool "${toolName}" requires approval before it can run (approval id: ${approvalId})`);
    this.name = 'ToolApprovalRequiredError';
  }
}
