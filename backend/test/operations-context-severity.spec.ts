import { OperationsContextProvider } from '../src/modules/ai/context/context.providers';
import { ActivitiesService } from '../src/modules/sales/activities/activities.service';
import { WorkflowService } from '../src/modules/workflows/workflow.service';

/**
 * Production severity contract for the Operations context source.
 *
 * This is the contract Business Intelligence scores against, so it is
 * pinned here rather than inferred from a BI assertion:
 *
 *   no / future-dated open activity  -> medium   (no deduction)
 *   overdue open activity            -> high     (-10)
 *   completed activity               -> excluded (never collected)
 *   successful workflow run          -> excluded (only FAILED is queried)
 *   failed workflow run              -> critical (-25)
 *   pending workflow approval        -> high     (-10)
 *
 * Nothing else in the provider can emit `critical`, which is why a BI test
 * that wants a critical deduction must build a real failed workflow run.
 */

const PERMISSIONS = ['sales.activity.read', 'workflow.read', 'workflow.approve'];

function buildProvider(
  overrides: {
    activities?: Array<Record<string, unknown>>;
    failedRuns?: Array<Record<string, unknown>>;
    approvals?: Array<Record<string, unknown>>;
  } = {},
) {
  const listRuns = jest.fn().mockResolvedValue({
    items: overrides.failedRuns ?? [],
    total: (overrides.failedRuns ?? []).length,
  });
  const listPendingApprovals = jest.fn().mockResolvedValue({
    items: overrides.approvals ?? [],
    total: (overrides.approvals ?? []).length,
  });
  const findAll = jest.fn().mockResolvedValue({
    items: overrides.activities ?? [],
    total: (overrides.activities ?? []).length,
  });

  const provider = new OperationsContextProvider(
    { findAll } as unknown as ActivitiesService,
    { listRuns, listPendingApprovals } as unknown as WorkflowService,
  );
  return { provider, findAll, listRuns, listPendingApprovals };
}

function activity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'activity-1',
    subject: 'Follow up with the customer',
    type: 'TASK',
    completed: false,
    dueAt: null,
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

function failedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    status: 'FAILED',
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

const PAST = new Date('2020-01-01T00:00:00.000Z').toISOString();
const FUTURE = new Date('2099-01-01T00:00:00.000Z').toISOString();

describe('Operations context severity contract', () => {
  describe('activities', () => {
    it('maps an activity with no due date to medium', async () => {
      const { provider } = buildProvider({ activities: [activity({ dueAt: null })] });
      const result = await provider.collect(PERMISSIONS);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].priority).toBe('medium');
    });

    it('maps a future-dated open activity to medium', async () => {
      const { provider } = buildProvider({ activities: [activity({ dueAt: FUTURE })] });
      const result = await provider.collect(PERMISSIONS);

      expect(result.items[0].priority).toBe('medium');
    });

    it('maps an overdue open activity to high, never critical', async () => {
      const { provider } = buildProvider({ activities: [activity({ dueAt: PAST })] });
      const result = await provider.collect(PERMISSIONS);

      expect(result.items[0].priority).toBe('high');
      expect(result.items[0].priority).not.toBe('critical');
    });

    it('never collects a completed activity — the query excludes it at the source', async () => {
      const { provider, findAll } = buildProvider({ activities: [] });
      await provider.collect(PERMISSIONS);

      // The provider asks the domain service for open activities only, so a
      // completed overdue activity can never reach the context.
      expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ completed: false }));
    });

    it('scales with the number of overdue activities without escalating severity', async () => {
      const { provider } = buildProvider({
        activities: [
          activity({ id: 'a', dueAt: PAST }),
          activity({ id: 'b', dueAt: PAST }),
          activity({ id: 'c', dueAt: PAST }),
        ],
      });
      const result = await provider.collect(PERMISSIONS);

      expect(result.items).toHaveLength(3);
      expect(result.items.every((item) => item.priority === 'high')).toBe(true);
    });
  });

  describe('workflow runs', () => {
    it('maps a failed workflow run to critical', async () => {
      const { provider } = buildProvider({ failedRuns: [failedRun()] });
      const result = await provider.collect(PERMISSIONS);

      const run = result.items.find((item) => item.id.startsWith('workflow-run:'));
      expect(run?.priority).toBe('critical');
      expect(run?.details).toEqual(
        expect.objectContaining({ type: 'workflow_failure', status: 'FAILED' }),
      );
    });

    it('never collects a successful run — only FAILED is queried', async () => {
      const { provider, listRuns } = buildProvider({ failedRuns: [] });
      const result = await provider.collect(PERMISSIONS);

      expect(listRuns).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED' }));
      expect(result.items.some((item) => item.id.startsWith('workflow-run:'))).toBe(false);
    });

    it('maps a pending workflow approval to high', async () => {
      const { provider } = buildProvider({
        approvals: [
          { id: 'approval-1', createdAt: new Date('2026-08-02T00:00:00.000Z'), expiresAt: null },
        ],
      });
      const result = await provider.collect(PERMISSIONS);

      const approval = result.items.find((item) => item.id.startsWith('workflow-approval:'));
      expect(approval?.priority).toBe('high');
    });
  });

  describe('the critical boundary', () => {
    it('emits critical only for a failed workflow run', async () => {
      const { provider } = buildProvider({
        activities: [
          activity({ id: 'overdue', dueAt: PAST }),
          activity({ id: 'future', dueAt: FUTURE }),
        ],
        failedRuns: [failedRun()],
        approvals: [{ id: 'approval-1', createdAt: new Date(), expiresAt: null }],
      });
      const result = await provider.collect(PERMISSIONS);

      const critical = result.items.filter((item) => item.priority === 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe('workflow-run:run-1');

      // The rest of the section is high/medium — the exact deduction mix
      // Business Intelligence scores against.
      expect(result.items.filter((item) => item.priority === 'high')).toHaveLength(2);
      expect(result.items.filter((item) => item.priority === 'medium')).toHaveLength(1);
    });

    it('collects nothing a role cannot read', async () => {
      const { provider, findAll, listRuns, listPendingApprovals } = buildProvider({
        activities: [activity({ dueAt: PAST })],
        failedRuns: [failedRun()],
      });
      const result = await provider.collect([]);

      expect(findAll).not.toHaveBeenCalled();
      expect(listRuns).not.toHaveBeenCalled();
      expect(listPendingApprovals).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });
  });
});
