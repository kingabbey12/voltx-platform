import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_METADATA_KEY } from '../constants/permissions-metadata.constants';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
