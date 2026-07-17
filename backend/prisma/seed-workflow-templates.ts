import { PrismaClient } from '@prisma/client';
import { WorkflowDefinitionValidatorService } from '../src/modules/workflows/definition/workflow-definition-validator.service';
import { WorkflowDefinition } from '../src/modules/workflows/definition/workflow-definition.types';

const prisma = new PrismaClient();
const validator = new WorkflowDefinitionValidatorService();

interface TemplateSeed {
  key: string;
  name: string;
  category: string;
  description: string;
  definition: WorkflowDefinition;
}

const OPERATOR = 'Voltx Operator';

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    key: 'lead_follow_up',
    name: 'Lead follow-up',
    category: 'Sales',
    description:
      'Finds leads that need attention and creates a follow-up task and note for each one.',
    definition: {
      steps: [
        {
          id: 'follow_up',
          name: 'Find and follow up on leads',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use search_leads to find leads with status NEW or CONTACTED. For each one that looks like it needs follow-up, create a follow-up task due in 2 business days via create_task, and add a note via add_note describing the recommended next step.',
          },
        },
      ],
    },
  },
  {
    key: 'new_customer_onboarding',
    name: 'New customer onboarding',
    category: 'Sales',
    description:
      'Creates onboarding tasks for newly closed-won deals and drafts a welcome email.',
    definition: {
      steps: [
        {
          id: 'kick_off_onboarding',
          name: 'Kick off onboarding',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              "Use search_opportunities to find deals with stage CLOSED_WON. For each one that doesn't already have an onboarding task, create a task via create_task titled \"Kick off customer onboarding\" due in 1 business day, and add a note via add_note welcoming the new customer.",
          },
        },
        {
          id: 'draft_welcome_email',
          name: 'Draft welcome email',
          type: 'AGENT',
          dependsOn: ['kick_off_onboarding'],
          config: {
            agentName: 'Sales Assistant',
            objective:
              'Draft a warm, professional welcome email for a newly onboarded customer, referencing that their onboarding kickoff has been scheduled.',
          },
        },
      ],
    },
  },
  {
    key: 'missed_payment',
    name: 'Missed payment',
    category: 'Finance',
    description:
      'Checks for signs of an overdue payment, waits a day, then logs a reminder for the finance team.',
    definition: {
      steps: [
        {
          id: 'check_payment_status',
          name: 'Check for missed payments',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use get_revenue_summary and search_overdue_activities to check for signs of a missed or overdue payment (for example, overdue follow-up activities whose subject mentions invoice or payment). For anything you find, create a task via create_task to chase the payment, due tomorrow.',
          },
        },
        {
          id: 'grace_period',
          name: 'Wait one day',
          type: 'DELAY',
          dependsOn: ['check_payment_status'],
          config: { delayMs: 86400000 },
        },
        {
          id: 'notify_finance',
          name: 'Notify finance team',
          type: 'NOTIFICATION',
          dependsOn: ['grace_period'],
          config: { channel: 'log', message: 'Missed-payment check complete — see workflow run output for details.' },
        },
      ],
    },
  },
  {
    key: 'deal_won',
    name: 'Deal won',
    category: 'Sales',
    description: 'Celebrates and follows up on newly closed-won deals.',
    definition: {
      steps: [
        {
          id: 'celebrate_and_follow_up',
          name: 'Celebrate and schedule kickoff',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use search_opportunities to find deals with stage CLOSED_WON. For each, add a congratulatory note via add_note and create a follow-up task via create_task for the account manager to schedule a kickoff call within a week.',
          },
        },
        {
          id: 'notify_team',
          name: 'Notify team',
          type: 'NOTIFICATION',
          dependsOn: ['celebrate_and_follow_up'],
          config: { channel: 'log', message: 'Deal-won follow-ups created.' },
        },
      ],
    },
  },
  {
    key: 'deal_lost',
    name: 'Deal lost',
    category: 'Sales',
    description: 'Captures the loss reason and schedules a win-back check-in.',
    definition: {
      steps: [
        {
          id: 'capture_loss_and_schedule_winback',
          name: 'Capture reason and schedule win-back',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use search_opportunities to find deals with stage CLOSED_LOST. For each, add a note via add_note capturing the likely reason if known from existing notes, and create a task via create_task to schedule a win-back check-in in 90 days.',
          },
        },
      ],
    },
  },
  {
    key: 'support_escalation',
    name: 'Support escalation',
    category: 'Support',
    description: 'Finds overdue support activities and escalates the ones that are badly overdue.',
    definition: {
      steps: [
        {
          id: 'find_overdue',
          name: 'Find overdue activities',
          type: 'TOOL',
          config: { toolName: 'search_overdue_activities', input: {} },
        },
        {
          id: 'escalate',
          name: 'Escalate badly overdue items',
          type: 'AGENT',
          dependsOn: ['find_overdue'],
          config: {
            agentName: OPERATOR,
            objective:
              'Review the overdue activities found in the previous step (see your context). For any overdue by more than 2 days, escalate by creating a high-priority follow-up task via create_task, clearly marked as an escalation in its description.',
          },
        },
        {
          id: 'notify_escalation',
          name: 'Log escalation',
          type: 'NOTIFICATION',
          dependsOn: ['escalate'],
          config: { channel: 'log', message: 'Support escalation pass complete.' },
        },
      ],
    },
  },
  {
    key: 'invoice_reminder',
    name: 'Invoice reminder',
    category: 'Finance',
    description: 'Finds overdue payment-related activities and schedules reminders.',
    definition: {
      steps: [
        {
          id: 'find_and_remind',
          name: 'Find and remind on overdue invoices',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use search_overdue_activities to find overdue activities whose subject or description mentions invoice or payment. For each, create a reminder task via create_task due tomorrow, and add a note via add_note logging that a reminder was scheduled.',
          },
        },
      ],
    },
  },
  {
    key: 'meeting_reminder',
    name: 'Meeting reminder',
    category: 'Calendar',
    description:
      'Reminds each attendee passed in this run\'s input.attendees (e.g. [{ userId, name }]) about an upcoming meeting. Typically triggered by a DELAYED schedule shortly before the meeting.',
    definition: {
      steps: [
        {
          id: 'remind_each_attendee',
          name: 'Remind each attendee',
          type: 'LOOP',
          config: {
            itemsPath: 'input.attendees',
            maxIterations: 50,
            steps: [
              {
                id: 'remind_attendee',
                name: 'Send reminder',
                type: 'AGENT',
                config: {
                  agentName: OPERATOR,
                  objective:
                    'You are reminding one meeting attendee, given to you as loopItem in your context, about an upcoming meeting. If their user id is available, send them a friendly reminder notification via send_notification.',
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'birthday_message',
    name: 'Birthday message',
    category: 'Communications',
    description: 'Drafts a birthday greeting for review and manual sending.',
    definition: {
      steps: [
        {
          id: 'draft_greeting',
          name: 'Draft birthday greeting',
          type: 'AGENT',
          config: {
            agentName: 'Communications Assistant',
            objective: 'Draft a warm, brief birthday greeting suitable for sending to a customer today.',
          },
        },
        {
          id: 'notify_drafted',
          name: 'Log draft ready',
          type: 'NOTIFICATION',
          dependsOn: ['draft_greeting'],
          config: {
            channel: 'log',
            message: 'Birthday greeting drafted — review the run output and send it via the inbox.',
          },
        },
      ],
    },
  },
  {
    key: 'contract_approval',
    name: 'Contract approval',
    category: 'Legal',
    description: 'Generates a contract PDF and requires manager approval before it goes out.',
    definition: {
      steps: [
        {
          id: 'generate_contract',
          name: 'Generate contract',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Generate a standard services contract PDF via generate_contract, using a reasonable default title and template body, ready for internal review.',
          },
        },
        {
          id: 'approve_contract',
          name: 'Approve contract',
          type: 'APPROVAL',
          dependsOn: ['generate_contract'],
          config: {
            message: 'Review the generated contract and approve it before it is sent to the customer.',
            approverRole: 'manager',
          },
        },
        {
          id: 'notify_approved',
          name: 'Log approval',
          type: 'NOTIFICATION',
          dependsOn: ['approve_contract'],
          config: { channel: 'log', message: 'Contract approved — proceed with sending it to the customer.' },
        },
      ],
    },
  },
  {
    key: 'employee_onboarding',
    name: 'Employee onboarding',
    category: 'HR',
    description: 'Creates standard new-hire onboarding tasks, gated by manager approval.',
    definition: {
      steps: [
        {
          id: 'create_onboarding_tasks',
          name: 'Create onboarding tasks',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Create the standard new-hire onboarding tasks via create_task: equipment setup, account provisioning, and a first-week check-in, each due within the new hire\'s first week.',
          },
        },
        {
          id: 'approve_onboarding',
          name: 'Approve onboarding plan',
          type: 'APPROVAL',
          dependsOn: ['create_onboarding_tasks'],
          config: {
            message: "Confirm the new hire's onboarding tasks look correct before notifying the team.",
            approverRole: 'manager',
          },
        },
        {
          id: 'notify_active',
          name: 'Log onboarding active',
          type: 'NOTIFICATION',
          dependsOn: ['approve_onboarding'],
          config: { channel: 'log', message: 'Employee onboarding tasks confirmed and active.' },
        },
      ],
    },
  },
  {
    key: 'ai_daily_summary',
    name: 'AI daily summary',
    category: 'Operations',
    description: 'Produces a concise daily summary of business health across every domain.',
    definition: {
      steps: [
        {
          id: 'generate_summary',
          name: 'Generate daily summary',
          type: 'AGENT',
          config: {
            agentName: 'Executive Assistant',
            objective:
              'Produce a concise daily summary of business health, delegating to the Sales, Support, Operations, and Finance specialists as needed, covering pipeline movement, overdue activities, and any workflow failures.',
          },
        },
        {
          id: 'notify_summary_ready',
          name: 'Log summary ready',
          type: 'NOTIFICATION',
          dependsOn: ['generate_summary'],
          config: { channel: 'log', message: 'Daily summary generated — see workflow run output.' },
        },
      ],
    },
  },
  {
    key: 'sales_report',
    name: 'Sales report',
    category: 'Sales',
    description: 'Generates a PDF sales report from current pipeline and revenue data.',
    definition: {
      steps: [
        {
          id: 'generate_report',
          name: 'Generate sales report',
          type: 'AGENT',
          config: {
            agentName: OPERATOR,
            objective:
              'Use get_pipeline_summary and get_revenue_summary to gather current pipeline and revenue data, then generate a PDF sales report via generate_pdf summarizing the findings in a few clear sections.',
          },
        },
        {
          id: 'notify_report_ready',
          name: 'Log report ready',
          type: 'NOTIFICATION',
          dependsOn: ['generate_report'],
          config: { channel: 'log', message: 'Sales report generated and stored as an attachment.' },
        },
      ],
    },
  },
  {
    key: 'executive_report',
    name: 'Executive report',
    category: 'Executive',
    description: 'Synthesizes a cross-functional executive summary into a polished PDF report.',
    definition: {
      steps: [
        {
          id: 'synthesize_summary',
          name: 'Synthesize executive summary',
          type: 'AGENT',
          config: {
            agentName: 'Executive Assistant',
            objective:
              'Delegate to the Sales, Support, Operations, and Finance specialists to gather a full picture of business health, then produce a polished executive summary covering key metrics, risks, and recommendations.',
          },
        },
        {
          id: 'generate_pdf_report',
          name: 'Generate PDF report',
          type: 'AGENT',
          dependsOn: ['synthesize_summary'],
          config: {
            agentName: OPERATOR,
            objective:
              'Using the executive summary produced in the previous step (see your context), generate a polished PDF report via generate_pdf with clear sections.',
          },
        },
        {
          id: 'notify_report_ready',
          name: 'Log report ready',
          type: 'NOTIFICATION',
          dependsOn: ['generate_pdf_report'],
          config: { channel: 'log', message: 'Executive report generated and stored as an attachment.' },
        },
      ],
    },
  },
];

async function seedWorkflowTemplates(): Promise<void> {
  if (TEMPLATE_SEEDS.length !== 14) {
    throw new Error(`Expected exactly 14 workflow templates, found ${TEMPLATE_SEEDS.length}`);
  }

  for (const template of TEMPLATE_SEEDS) {
    try {
      validator.validate(template.definition);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Template "${template.key}" failed validation: ${message}`);
    }

    await prisma.workflowTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        category: template.category,
        definition: template.definition as never,
        isSystem: true,
        organizationId: null,
      },
      update: {
        name: template.name,
        description: template.description,
        category: template.category,
        definition: template.definition as never,
        isSystem: true,
      },
    });
    console.log(`Seeded workflow template "${template.key}"`);
  }
}

if (require.main === module) {
  seedWorkflowTemplates()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { seedWorkflowTemplates, TEMPLATE_SEEDS, prisma as workflowTemplatesSeedClient };
