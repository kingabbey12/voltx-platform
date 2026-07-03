import { Request } from 'express';
import { AuthPrincipal } from './auth-principal.interface';
import { CurrentUser } from './current-user.interface';
import {
  TenantContext,
  TenantJwtPrincipal,
} from '../../../common/tenant/interfaces/tenant-context.interface';

export interface AuthenticatedRequest extends Request {
  authPrincipal?: AuthPrincipal;
  currentUser?: CurrentUser;
  tenantJwtPrincipal?: TenantJwtPrincipal;
  tenantContext?: TenantContext;
}
