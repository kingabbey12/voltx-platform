import { Request } from 'express';

export interface ScimContext {
  organizationId: string;
  scimTokenId: string;
}

export interface ScimAuthenticatedRequest extends Request {
  scimContext?: ScimContext;
}
