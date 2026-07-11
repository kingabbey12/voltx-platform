import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:voltx_mobile/features/ai/presentation/screens/ai_workflow_approvals_screen.dart';
import 'package:voltx_mobile/features/workflows/data/models/workflow_models.dart';
import 'package:voltx_mobile/features/workflows/data/repositories/workflow_repository.dart';
import 'package:voltx_mobile/features/workflows/presentation/providers/workflow_providers.dart';
import 'package:voltx_mobile/router/routes.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

class _FakeWorkflowRepository implements WorkflowRepository {
  _FakeWorkflowRepository({this.approvals = const []});

  final List<WorkflowApproval> approvals;
  String? lastDecidedApprovalId;
  String? lastDecision;

  @override
  Future<PaginatedWorkflowResult<WorkflowApproval>> listApprovals({
    required int page,
    required int limit,
  }) async {
    return PaginatedWorkflowResult<WorkflowApproval>(
      items: approvals,
      total: approvals.length,
      page: page,
      limit: limit,
      totalPages: 1,
    );
  }

  @override
  Future<WorkflowApproval> decideApproval(
    String approvalId, {
    required String decision,
    String? comment,
  }) async {
    lastDecidedApprovalId = approvalId;
    lastDecision = decision;
    final target = approvals.firstWhere((a) => a.id == approvalId);
    return WorkflowApproval(
      id: target.id,
      workflowRunId: target.workflowRunId,
      stepRunId: target.stepRunId,
      status: decision,
      createdAt: target.createdAt,
      decidedAt: '2026-01-01T00:00:00.000Z',
    );
  }

  @override
  Future<Workflow> archiveWorkflow(String id) => throw UnimplementedError();

  @override
  Future<WorkflowRun> cancelRun(String runId) => throw UnimplementedError();

  @override
  Future<Workflow> getWorkflow(String id) => throw UnimplementedError();

  @override
  Future<WorkflowHealth> getHealth(String workflowId) => throw UnimplementedError();

  @override
  Future<WorkflowMetrics> getMetrics(String workflowId) => throw UnimplementedError();

  @override
  Future<WorkflowRun> getRun(String runId) => throw UnimplementedError();

  @override
  Future<PaginatedWorkflowResult<WorkflowRun>> listRuns(
    String workflowId, {
    required int page,
    required int limit,
    String? status,
  }) =>
      throw UnimplementedError();

  @override
  Future<PaginatedWorkflowResult<WorkflowLog>> listRunLogs(
    String runId, {
    required int page,
    required int limit,
  }) =>
      throw UnimplementedError();

  @override
  Future<PaginatedWorkflowResult<Workflow>> listWorkflows(WorkflowPageQuery query) =>
      throw UnimplementedError();

  @override
  Future<WorkflowRun> pauseRun(String runId) => throw UnimplementedError();

  @override
  Future<Workflow> publishWorkflow(String id) => throw UnimplementedError();

  @override
  Future<WorkflowRun> resumeRun(String runId) => throw UnimplementedError();

  @override
  Future<WorkflowRun> retryRun(String runId) => throw UnimplementedError();

  @override
  Future<WorkflowRun> runWorkflow(String workflowId, {Map<String, dynamic>? input}) =>
      throw UnimplementedError();
}

Widget _wrap(Widget child, {required List<Override> overrides}) {
  final router = GoRouter(
    initialLocation: AppRoutes.aiWorkflowApprovals,
    routes: [
      GoRoute(
        path: AppRoutes.aiWorkflowApprovals,
        builder: (context, state) => Scaffold(body: child),
      ),
    ],
  );

  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  );
}

void main() {
  group('AiWorkflowApprovalsScreen', () {
    testWidgets('shows the empty state when there is nothing pending', (tester) async {
      final repository = _FakeWorkflowRepository();

      await tester.pumpWidget(
        _wrap(
          const AiWorkflowApprovalsScreen(),
          overrides: [workflowRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nothing pending'), findsOneWidget);
    });

    testWidgets('renders a pending approval and approves it on tap', (tester) async {
      final repository = _FakeWorkflowRepository(
        approvals: const [
          WorkflowApproval(
            id: 'approval-1',
            workflowRunId: 'run-12345678',
            stepRunId: 'step-1',
            status: 'PENDING',
            createdAt: '2026-01-01T00:00:00.000Z',
          ),
        ],
      );

      await tester.pumpWidget(
        _wrap(
          const AiWorkflowApprovalsScreen(),
          overrides: [workflowRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Run run-1234'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Approve'));
      await tester.pumpAndSettle();

      expect(repository.lastDecidedApprovalId, 'approval-1');
      expect(repository.lastDecision, 'APPROVED');
    });
  });
}
