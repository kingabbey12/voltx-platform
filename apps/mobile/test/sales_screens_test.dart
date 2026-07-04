import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/sales/data/models/sales_models.dart';
import 'package:voltx_mobile/features/sales/data/repositories/sales_repository.dart';
import 'package:voltx_mobile/features/sales/presentation/providers/sales_providers.dart';
import 'package:voltx_mobile/features/sales/presentation/screens/lead_pipeline_screen.dart';
import 'package:voltx_mobile/features/sales/presentation/screens/sales_dashboard_screen.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

class _FakeSalesRepository implements SalesRepository {
  const _FakeSalesRepository();

  @override
  Future<SalesAiActionResult> draftEmail(String contactId, {String? prompt}) async {
    return const SalesAiActionResult(
      conversationId: 'conversation-1',
      agentRunId: 'run-1',
      outputText: 'Email draft ready',
    );
  }

  @override
  Future<SalesActivity> getActivity(String id) async => _activity;

  @override
  Future<SalesCompany> getCompany(String id) async => _company;

  @override
  Future<SalesContact> getContact(String id) async => _contact;

  @override
  Future<SalesLead> getLead(String id) async => _lead;

  @override
  Future<SalesOpportunity> getOpportunity(String id) async => _opportunity;

  @override
  Future<PaginatedSalesResult<SalesActivity>> listActivities(SalesPageQuery query) async {
    return const PaginatedSalesResult(
      items: [_activity],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<PaginatedSalesResult<SalesCompany>> listCompanies(SalesPageQuery query) async {
    return const PaginatedSalesResult(
      items: [_company],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<PaginatedSalesResult<SalesContact>> listContacts(SalesPageQuery query) async {
    return const PaginatedSalesResult(
      items: [_contact],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<PaginatedSalesResult<SalesLead>> listLeads(SalesPageQuery query) async {
    return const PaginatedSalesResult(
      items: [_lead],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<PaginatedSalesResult<SalesOpportunity>> listOpportunities(SalesPageQuery query) async {
    return const PaginatedSalesResult(
      items: [_opportunity],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<SalesAiActionResult> meetingSummary(String activityId, {String? prompt}) async {
    return const SalesAiActionResult(
      conversationId: 'conversation-1',
      agentRunId: 'run-2',
      outputText: 'Meeting summary ready',
    );
  }

  @override
  Future<SalesAiActionResult> nextBestAction(String opportunityId, {String? prompt}) async {
    return const SalesAiActionResult(
      conversationId: 'conversation-1',
      agentRunId: 'run-3',
      outputText: 'Book the executive alignment call',
    );
  }

  @override
  Future<SalesAiActionResult> opportunityInsights(String opportunityId, {String? prompt}) async {
    return const SalesAiActionResult(
      conversationId: 'conversation-1',
      agentRunId: 'run-4',
      outputText: 'Opportunity is healthy with procurement urgency',
    );
  }

  @override
  Future<SalesAiActionResult> qualifyLead(String leadId, {String? prompt}) async {
    return const SalesAiActionResult(
      conversationId: 'conversation-1',
      agentRunId: 'run-5',
      outputText: 'Lead is highly qualified',
    );
  }
}

const _company = SalesCompany(
  id: 'company-1',
  name: 'Acme Energy',
  status: 'ACTIVE',
  industry: 'Energy',
);

const _contact = SalesContact(
  id: 'contact-1',
  companyId: 'company-1',
  firstName: 'Taylor',
  lastName: 'Morgan',
  email: 'taylor@acme.energy',
);

const _lead = SalesLead(
  id: 'lead-1',
  companyId: 'company-1',
  contactId: 'contact-1',
  title: 'Acme Energy expansion',
  status: 'NEW',
  source: 'Inbound demo',
);

const _opportunity = SalesOpportunity(
  id: 'opportunity-1',
  companyId: 'company-1',
  contactId: 'contact-1',
  leadId: 'lead-1',
  title: 'EMEA rollout',
  stage: 'DISCOVERY',
  currency: 'USD',
  probability: 55,
  amount: 125000,
);

const _activity = SalesActivity(
  id: 'activity-1',
  companyId: 'company-1',
  contactId: 'contact-1',
  leadId: 'lead-1',
  opportunityId: 'opportunity-1',
  type: 'MEETING',
  subject: 'Discovery call',
  completed: true,
);

void main() {
  group('Sales screens', () {
    testWidgets('SalesDashboardScreen renders key sections', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            salesRepositoryProvider.overrideWithValue(const _FakeSalesRepository()),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(body: SalesDashboardScreen()),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Sales Command Center'), findsOneWidget);
      expect(find.text('Recent Leads'), findsOneWidget);
      expect(find.text('Acme Energy expansion'), findsOneWidget);
    });

    testWidgets('LeadPipelineScreen shows pipeline content', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            salesRepositoryProvider.overrideWithValue(const _FakeSalesRepository()),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(body: LeadPipelineScreen()),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Lead Pipeline'), findsOneWidget);
      expect(find.text('Acme Energy expansion'), findsOneWidget);
      expect(find.text('Qualify'), findsOneWidget);
    });
  });
}
