import '../models/sales_models.dart';
import '../services/sales_api_service.dart';

abstract class SalesRepository {
  Future<PaginatedSalesResult<SalesCompany>> listCompanies(SalesPageQuery query);
  Future<SalesCompany> getCompany(String id);
  Future<PaginatedSalesResult<SalesContact>> listContacts(SalesPageQuery query);
  Future<SalesContact> getContact(String id);
  Future<SalesAiActionResult> draftEmail(String contactId, {String? prompt});
  Future<PaginatedSalesResult<SalesLead>> listLeads(SalesPageQuery query);
  Future<SalesLead> getLead(String id);
  Future<SalesAiActionResult> qualifyLead(String leadId, {String? prompt});
  Future<PaginatedSalesResult<SalesOpportunity>> listOpportunities(SalesPageQuery query);
  Future<SalesOpportunity> getOpportunity(String id);
  Future<SalesAiActionResult> opportunityInsights(String opportunityId, {String? prompt});
  Future<SalesAiActionResult> nextBestAction(String opportunityId, {String? prompt});
  Future<PaginatedSalesResult<SalesActivity>> listActivities(SalesPageQuery query);
  Future<SalesActivity> getActivity(String id);
  Future<SalesAiActionResult> meetingSummary(String activityId, {String? prompt});
}

class ApiSalesRepository implements SalesRepository {
  ApiSalesRepository(this._api);

  final SalesApiService _api;

  @override
  Future<PaginatedSalesResult<SalesCompany>> listCompanies(SalesPageQuery query) async {
    try {
      return await _api.listCompanies(query);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesCompany> getCompany(String id) async {
    try {
      return await _api.getCompany(id);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<PaginatedSalesResult<SalesContact>> listContacts(SalesPageQuery query) async {
    try {
      return await _api.listContacts(query);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesContact> getContact(String id) async {
    try {
      return await _api.getContact(id);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesAiActionResult> draftEmail(String contactId, {String? prompt}) async {
    try {
      return await _api.draftEmail(contactId, prompt: prompt);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<PaginatedSalesResult<SalesLead>> listLeads(SalesPageQuery query) async {
    try {
      return await _api.listLeads(query);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesLead> getLead(String id) async {
    try {
      return await _api.getLead(id);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesAiActionResult> qualifyLead(String leadId, {String? prompt}) async {
    try {
      return await _api.qualifyLead(leadId, prompt: prompt);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<PaginatedSalesResult<SalesOpportunity>> listOpportunities(SalesPageQuery query) async {
    try {
      return await _api.listOpportunities(query);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesOpportunity> getOpportunity(String id) async {
    try {
      return await _api.getOpportunity(id);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesAiActionResult> opportunityInsights(
    String opportunityId, {
    String? prompt,
  }) async {
    try {
      return await _api.opportunityInsights(opportunityId, prompt: prompt);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesAiActionResult> nextBestAction(String opportunityId, {String? prompt}) async {
    try {
      return await _api.nextBestAction(opportunityId, prompt: prompt);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<PaginatedSalesResult<SalesActivity>> listActivities(SalesPageQuery query) async {
    try {
      return await _api.listActivities(query);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesActivity> getActivity(String id) async {
    try {
      return await _api.getActivity(id);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }

  @override
  Future<SalesAiActionResult> meetingSummary(String activityId, {String? prompt}) async {
    try {
      return await _api.meetingSummary(activityId, prompt: prompt);
    } catch (error) {
      throw mapToSalesException(error);
    }
  }
}
