import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../constants/sales_api_paths.dart';
import '../models/sales_models.dart';

class SalesApiService {
  SalesApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedSalesResult<SalesCompany>> listCompanies(SalesPageQuery query) {
    return _apiClient.get(
      SalesApiPaths.companies,
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedSalesResult.fromJson(json, SalesCompany.fromJson),
    );
  }

  Future<SalesCompany> getCompany(String id) {
    return _apiClient.get(
      '${SalesApiPaths.companies}/$id',
      fromJson: SalesCompany.fromJson,
    );
  }

  Future<SalesCompany> createCompany(Map<String, dynamic> data) {
    return _apiClient.post(
      SalesApiPaths.companies,
      data: data,
      fromJson: SalesCompany.fromJson,
    );
  }

  Future<SalesCompany> updateCompany(String id, Map<String, dynamic> data) {
    return _apiClient.patch(
      '${SalesApiPaths.companies}/$id',
      data: data,
      fromJson: SalesCompany.fromJson,
    );
  }

  Future<SalesCompany> deleteCompany(String id) {
    return _apiClient.delete(
      '${SalesApiPaths.companies}/$id',
      fromJson: SalesCompany.fromJson,
    );
  }

  Future<PaginatedSalesResult<SalesContact>> listContacts(SalesPageQuery query) {
    return _apiClient.get(
      SalesApiPaths.contacts,
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedSalesResult.fromJson(json, SalesContact.fromJson),
    );
  }

  Future<SalesContact> getContact(String id) {
    return _apiClient.get(
      '${SalesApiPaths.contacts}/$id',
      fromJson: SalesContact.fromJson,
    );
  }

  Future<SalesContact> createContact(Map<String, dynamic> data) {
    return _apiClient.post(
      SalesApiPaths.contacts,
      data: data,
      fromJson: SalesContact.fromJson,
    );
  }

  Future<SalesContact> updateContact(String id, Map<String, dynamic> data) {
    return _apiClient.patch(
      '${SalesApiPaths.contacts}/$id',
      data: data,
      fromJson: SalesContact.fromJson,
    );
  }

  Future<SalesContact> deleteContact(String id) {
    return _apiClient.delete(
      '${SalesApiPaths.contacts}/$id',
      fromJson: SalesContact.fromJson,
    );
  }

  Future<SalesAiActionResult> draftEmail(String contactId, {String? prompt}) {
    return _apiClient.post(
      '${SalesApiPaths.contacts}/$contactId/draft-email',
      data: {
        if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      },
      fromJson: SalesAiActionResult.fromJson,
    );
  }

  Future<PaginatedSalesResult<SalesLead>> listLeads(SalesPageQuery query) {
    return _apiClient.get(
      SalesApiPaths.leads,
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedSalesResult.fromJson(json, SalesLead.fromJson),
    );
  }

  Future<SalesLead> getLead(String id) {
    return _apiClient.get(
      '${SalesApiPaths.leads}/$id',
      fromJson: SalesLead.fromJson,
    );
  }

  Future<SalesLead> createLead(Map<String, dynamic> data) {
    return _apiClient.post(
      SalesApiPaths.leads,
      data: data,
      fromJson: SalesLead.fromJson,
    );
  }

  Future<SalesLead> updateLead(String id, Map<String, dynamic> data) {
    return _apiClient.patch(
      '${SalesApiPaths.leads}/$id',
      data: data,
      fromJson: SalesLead.fromJson,
    );
  }

  Future<SalesLead> deleteLead(String id) {
    return _apiClient.delete(
      '${SalesApiPaths.leads}/$id',
      fromJson: SalesLead.fromJson,
    );
  }

  Future<SalesAiActionResult> qualifyLead(String leadId, {String? prompt}) {
    return _apiClient.post(
      '${SalesApiPaths.leads}/$leadId/qualify',
      data: {
        if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      },
      fromJson: SalesAiActionResult.fromJson,
    );
  }

  Future<PaginatedSalesResult<SalesOpportunity>> listOpportunities(SalesPageQuery query) {
    return _apiClient.get(
      SalesApiPaths.opportunities,
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedSalesResult.fromJson(json, SalesOpportunity.fromJson),
    );
  }

  Future<SalesOpportunity> getOpportunity(String id) {
    return _apiClient.get(
      '${SalesApiPaths.opportunities}/$id',
      fromJson: SalesOpportunity.fromJson,
    );
  }

  Future<SalesOpportunity> createOpportunity(Map<String, dynamic> data) {
    return _apiClient.post(
      SalesApiPaths.opportunities,
      data: data,
      fromJson: SalesOpportunity.fromJson,
    );
  }

  Future<SalesOpportunity> updateOpportunity(String id, Map<String, dynamic> data) {
    return _apiClient.patch(
      '${SalesApiPaths.opportunities}/$id',
      data: data,
      fromJson: SalesOpportunity.fromJson,
    );
  }

  Future<SalesOpportunity> deleteOpportunity(String id) {
    return _apiClient.delete(
      '${SalesApiPaths.opportunities}/$id',
      fromJson: SalesOpportunity.fromJson,
    );
  }

  Future<SalesAiActionResult> opportunityInsights(String opportunityId, {String? prompt}) {
    return _apiClient.post(
      '${SalesApiPaths.opportunities}/$opportunityId/insights',
      data: {
        if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      },
      fromJson: SalesAiActionResult.fromJson,
    );
  }

  Future<SalesAiActionResult> nextBestAction(String opportunityId, {String? prompt}) {
    return _apiClient.post(
      '${SalesApiPaths.opportunities}/$opportunityId/next-best-action',
      data: {
        if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      },
      fromJson: SalesAiActionResult.fromJson,
    );
  }

  Future<PaginatedSalesResult<SalesActivity>> listActivities(SalesPageQuery query) {
    return _apiClient.get(
      SalesApiPaths.activities,
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedSalesResult.fromJson(json, SalesActivity.fromJson),
    );
  }

  Future<SalesActivity> getActivity(String id) {
    return _apiClient.get(
      '${SalesApiPaths.activities}/$id',
      fromJson: SalesActivity.fromJson,
    );
  }

  Future<SalesActivity> createActivity(Map<String, dynamic> data) {
    return _apiClient.post(
      SalesApiPaths.activities,
      data: data,
      fromJson: SalesActivity.fromJson,
    );
  }

  Future<SalesActivity> updateActivity(String id, Map<String, dynamic> data) {
    return _apiClient.patch(
      '${SalesApiPaths.activities}/$id',
      data: data,
      fromJson: SalesActivity.fromJson,
    );
  }

  Future<SalesActivity> deleteActivity(String id) {
    return _apiClient.delete(
      '${SalesApiPaths.activities}/$id',
      fromJson: SalesActivity.fromJson,
    );
  }

  Future<SalesAiActionResult> meetingSummary(String activityId, {String? prompt}) {
    return _apiClient.post(
      '${SalesApiPaths.activities}/$activityId/meeting-summary',
      data: {
        if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      },
      fromJson: SalesAiActionResult.fromJson,
    );
  }
}

SalesException mapToSalesException(Object error) {
  if (error is SalesException) {
    return error;
  }
  if (error is NetworkException) {
    return SalesException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const SalesException('Unable to complete sales request.');
}

class SalesException implements Exception {
  const SalesException(this.message);

  final String message;

  @override
  String toString() => message;
}
