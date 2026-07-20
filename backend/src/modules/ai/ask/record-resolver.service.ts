import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../../sales/activities/activities.service';
import { CompaniesService } from '../../sales/companies/companies.service';
import { ContactsService } from '../../sales/contacts/contacts.service';
import { LeadsService } from '../../sales/leads/leads.service';
import { OpportunitiesService } from '../../sales/opportunities/opportunities.service';

/**
 * Resolves a door to its canonical record (docs/design/ASK.md §6 "Record
 * linking", COMPANY.md §5): one immutable id, one canonical owner, one route.
 *
 * Tenant isolation is inherited from the underlying sales services, whose
 * repositories scope every query to the tenant context's organizationId —
 * a cross-tenant id resolves to NotFound, indistinguishable from absence.
 * RBAC is enforced here per record type against the caller's permissions:
 * a denial is explained by role and never confirms the record exists.
 */

export interface ResolvedRecord {
  type: string;
  id: string;
  label: string;
  /** The canonical place this record is read in the product. */
  route: string;
}

interface RecordTypeBinding {
  permission: string;
  resolve: (id: string) => Promise<{ label: string; route: string }>;
}

@Injectable()
export class RecordResolverService {
  private readonly bindings: Record<string, RecordTypeBinding>;

  constructor(
    companiesService: CompaniesService,
    contactsService: ContactsService,
    leadsService: LeadsService,
    opportunitiesService: OpportunitiesService,
    activitiesService: ActivitiesService,
  ) {
    this.bindings = {
      'sales.company': {
        permission: 'sales.company.read',
        resolve: async (id) => {
          const company = await companiesService.findOne(id);
          return { label: company.name, route: `/crm/companies/${id}` };
        },
      },
      'sales.contact': {
        permission: 'sales.contact.read',
        resolve: async (id) => {
          const contact = await contactsService.findOne(id);
          return {
            label: `${contact.firstName} ${contact.lastName}`.trim(),
            route: `/crm/contacts`,
          };
        },
      },
      'sales.lead': {
        permission: 'sales.lead.read',
        resolve: async (id) => {
          const lead = await leadsService.findOne(id);
          return { label: lead.title, route: `/crm/leads` };
        },
      },
      'sales.opportunity': {
        permission: 'sales.opportunity.read',
        resolve: async (id) => {
          const opportunity = await opportunitiesService.findOne(id);
          return { label: opportunity.title, route: `/crm/opportunities` };
        },
      },
      'sales.activity': {
        permission: 'sales.activity.read',
        resolve: async (id) => {
          const activity = await activitiesService.findOne(id);
          return { label: activity.subject, route: `/crm` };
        },
      },
    };
  }

  supportedTypes(): string[] {
    return Object.keys(this.bindings);
  }

  async resolve(type: string, id: string, grantedPermissions: string[]): Promise<ResolvedRecord> {
    const binding = this.bindings[type];
    if (!binding) {
      throw new NotFoundException(`Unknown record type "${type}"`);
    }
    if (!grantedPermissions.includes(binding.permission)) {
      // Denial names the role boundary, not the record.
      throw new ForbiddenException("That's outside what your role can see.");
    }
    const { label, route } = await binding.resolve(id);
    return { type, id, label, route };
  }
}
