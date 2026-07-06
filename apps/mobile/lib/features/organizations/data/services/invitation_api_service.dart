import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/invitation_models.dart';

class InvitationApiService {
  InvitationApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<List<OrganizationRole>> listRoles() async {
    return _apiClient.get(
      '/roles',
      fromJson: (json) => (json['items'] as List<dynamic>? ?? const [])
          .map((item) => OrganizationRole.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }

  Future<PaginatedInvitationsResult<Invitation>> listInvitations(
    String organizationId,
    InvitationPageQuery query,
  ) {
    return _apiClient.get(
      '/organizations/$organizationId/invitations',
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedInvitationsResult.fromJson(json, Invitation.fromJson),
    );
  }

  Future<Invitation> createInvitation(
    String organizationId, {
    required String email,
    required String roleId,
  }) {
    return _apiClient.post(
      '/organizations/$organizationId/invitations',
      data: {'email': email, 'roleId': roleId},
      fromJson: Invitation.fromJson,
    );
  }

  Future<Invitation> resendInvitation(String organizationId, String invitationId) {
    return _apiClient.post(
      '/organizations/$organizationId/invitations/$invitationId/resend',
      fromJson: Invitation.fromJson,
    );
  }

  Future<Invitation> revokeInvitation(String organizationId, String invitationId) {
    return _apiClient.delete(
      '/organizations/$organizationId/invitations/$invitationId',
      fromJson: Invitation.fromJson,
    );
  }

  Future<InvitationPreview> previewInvitation(String token) {
    return _apiClient.get(
      '/invitations/$token',
      fromJson: InvitationPreview.fromJson,
    );
  }

  /// Returns the raw envelope `data` map — the shape differs depending on
  /// whether a new account was created (`{newAccount: true, session: {...}}`)
  /// or an existing one just got a new membership
  /// (`{newAccount: false, message: {...}}`); the repository decides which.
  Future<Map<String, dynamic>> acceptInvitation(
    String token, {
    String? password,
    String? firstName,
    String? lastName,
  }) {
    return _apiClient.post(
      '/invitations/$token/accept',
      data: {
        'password': ?password,
        'firstName': ?firstName,
        'lastName': ?lastName,
      },
      fromJson: (json) => json,
    );
  }
}

InvitationException mapToInvitationException(Object error) {
  if (error is InvitationException) {
    return error;
  }
  if (error is NetworkException) {
    final message =
        error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message;
    return InvitationException(message, statusCode: error.statusCode);
  }
  return const InvitationException('Unable to complete this invitation request.');
}

class InvitationException implements Exception {
  const InvitationException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
