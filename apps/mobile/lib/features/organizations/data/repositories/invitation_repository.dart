import '../../../auth/data/models/auth_tokens.dart';
import '../../../auth/data/models/auth_user.dart';
import '../models/invitation_models.dart';
import '../services/invitation_api_service.dart';

sealed class AcceptInvitationResult {
  const AcceptInvitationResult();
}

class AcceptInvitationNewAccount extends AcceptInvitationResult {
  const AcceptInvitationNewAccount(this.tokens, this.user);
  final AuthTokens tokens;
  final AuthUser user;
}

class AcceptInvitationExistingAccount extends AcceptInvitationResult {
  const AcceptInvitationExistingAccount(this.message);
  final String message;
}

abstract class InvitationRepository {
  Future<List<OrganizationRole>> listInvitableRoles();

  Future<PaginatedInvitationsResult<Invitation>> listInvitations(
    String organizationId,
    InvitationPageQuery query,
  );

  Future<Invitation> createInvitation(
    String organizationId, {
    required String email,
    required String roleId,
  });

  Future<Invitation> resendInvitation(String organizationId, String invitationId);

  Future<Invitation> revokeInvitation(String organizationId, String invitationId);

  Future<InvitationPreview> previewInvitation(String token);

  Future<AcceptInvitationResult> acceptInvitation(
    String token, {
    String? password,
    String? firstName,
    String? lastName,
  });
}

class ApiInvitationRepository implements InvitationRepository {
  ApiInvitationRepository(this._apiService);

  final InvitationApiService _apiService;

  static const _ownerRoleKey = 'owner';

  @override
  Future<List<OrganizationRole>> listInvitableRoles() async {
    try {
      final roles = await _apiService.listRoles();
      return roles.where((role) => role.key != _ownerRoleKey).toList();
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<PaginatedInvitationsResult<Invitation>> listInvitations(
    String organizationId,
    InvitationPageQuery query,
  ) async {
    try {
      return await _apiService.listInvitations(organizationId, query);
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<Invitation> createInvitation(
    String organizationId, {
    required String email,
    required String roleId,
  }) async {
    try {
      return await _apiService.createInvitation(organizationId, email: email, roleId: roleId);
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<Invitation> resendInvitation(String organizationId, String invitationId) async {
    try {
      return await _apiService.resendInvitation(organizationId, invitationId);
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<Invitation> revokeInvitation(String organizationId, String invitationId) async {
    try {
      return await _apiService.revokeInvitation(organizationId, invitationId);
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<InvitationPreview> previewInvitation(String token) async {
    try {
      return await _apiService.previewInvitation(token);
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }

  @override
  Future<AcceptInvitationResult> acceptInvitation(
    String token, {
    String? password,
    String? firstName,
    String? lastName,
  }) async {
    try {
      final data = await _apiService.acceptInvitation(
        token,
        password: password,
        firstName: firstName,
        lastName: lastName,
      );

      final newAccount = data['newAccount'] as bool? ?? false;
      if (newAccount) {
        final session = Map<String, dynamic>.from(data['session'] as Map);
        final userJson = Map<String, dynamic>.from(session['user'] as Map);
        return AcceptInvitationNewAccount(
          AuthTokens.fromJson(session),
          AuthUser.fromJson(userJson),
        );
      }

      final message = Map<String, dynamic>.from(data['message'] as Map);
      return AcceptInvitationExistingAccount(message['message'] as String? ?? 'Invitation accepted.');
    } catch (error) {
      throw mapToInvitationException(error);
    }
  }
}
