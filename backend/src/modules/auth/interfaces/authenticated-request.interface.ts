import { Request } from 'express';
import { AuthPrincipal } from './auth-principal.interface';
import { CurrentUser } from './current-user.interface';

export interface AuthenticatedRequest extends Request {
  authPrincipal?: AuthPrincipal;
  currentUser?: CurrentUser;
}
