import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/organizations/data/models/invitation_models.dart';
import 'package:voltx_mobile/features/organizations/data/models/organization_profile.dart';
import 'package:voltx_mobile/features/organizations/data/repositories/organization_repository.dart';
import 'package:voltx_mobile/features/organizations/data/services/invitation_api_service.dart';

void main() {
  group('Invitation.fromJson / status parsing', () {
    test('parses a known status and falls back to pending for anything unrecognized', () {
      final accepted = Invitation.fromJson(_invitationJson(status: 'ACCEPTED'));
      final unknown = Invitation.fromJson(_invitationJson(status: 'SOMETHING_NEW'));
      final missing = Invitation.fromJson(_invitationJson(status: null));

      expect(accepted.status, InvitationStatus.accepted);
      expect(unknown.status, InvitationStatus.pending);
      expect(missing.status, InvitationStatus.pending);
    });

    test('isExpired is true only when still pending and past expiresAt', () {
      final expiredPending = Invitation.fromJson(
        _invitationJson(status: 'PENDING', expiresAt: DateTime(2020, 1, 1)),
      );
      final futurePending = Invitation.fromJson(
        _invitationJson(status: 'PENDING', expiresAt: DateTime(2999, 1, 1)),
      );
      final expiredButAccepted = Invitation.fromJson(
        _invitationJson(status: 'ACCEPTED', expiresAt: DateTime(2020, 1, 1)),
      );

      expect(expiredPending.isExpired, isTrue);
      expect(futurePending.isExpired, isFalse);
      expect(expiredButAccepted.isExpired, isFalse);
    });
  });

  group('InvitationPreview.fromJson', () {
    test('defaults hasExistingAccount to false when omitted', () {
      final preview = InvitationPreview.fromJson({
        'organizationName': 'Acme',
        'invitedByName': 'Owner',
        'email': 'new@example.com',
        'roleName': 'Member',
        'status': 'PENDING',
        'expiresAt': DateTime(2999, 1, 1).toIso8601String(),
      });

      expect(preview.hasExistingAccount, isFalse);
    });
  });

  group('InvitationPageQuery', () {
    test('toQueryParameters maps the status enum to its API string value', () {
      const query = InvitationPageQuery(page: 1, limit: 20, status: InvitationStatus.revoked);
      expect(query.toQueryParameters(), {'page': 1, 'limit': 20, 'status': 'REVOKED'});
    });

    test('omits status when null and is value-equal', () {
      const a = InvitationPageQuery(page: 2, limit: 10);
      const b = InvitationPageQuery(page: 2, limit: 10);
      expect(a.toQueryParameters(), {'page': 2, 'limit': 10});
      expect(a, equals(b));
    });
  });

  group('PaginatedInvitationsResult.fromJson', () {
    test('falls back total/page/limit to item-derived defaults', () {
      final result = PaginatedInvitationsResult.fromJson(
        {
          'items': [_invitationJson(status: 'PENDING')],
        },
        Invitation.fromJson,
      );

      expect(result.items, hasLength(1));
      expect(result.total, 1);
      expect(result.page, 1);
    });
  });

  group('OrganizationProfile.fromJson', () {
    test('derives onboardingCompleted from the presence of onboardingCompletedAt', () {
      final incomplete = OrganizationProfile.fromJson(_organizationJson());
      final completed = OrganizationProfile.fromJson(
        _organizationJson(onboardingCompletedAt: '2026-01-01T00:00:00.000Z'),
      );

      expect(incomplete.onboardingCompleted, isFalse);
      expect(completed.onboardingCompleted, isTrue);
    });

    test('defaults timezone to UTC and status to ACTIVE when omitted', () {
      final profile = OrganizationProfile.fromJson({
        'id': 'org-1',
        'name': 'Acme',
        'slug': 'acme',
      });

      expect(profile.timezone, 'UTC');
      expect(profile.status, 'ACTIVE');
      expect(profile.primaryGoals, isEmpty);
    });
  });

  group('mapToOrganizationException', () {
    test('passes an existing OrganizationException through unchanged', () {
      const original = OrganizationException('already mapped');
      expect(mapToOrganizationException(original), same(original));
    });

    test('falls back to a generic message for any other error type', () {
      expect(
        mapToOrganizationException(StateError('boom')).message,
        'Unable to complete this organization request.',
      );
    });
  });

  group('mapToInvitationException', () {
    test('passes an existing InvitationException through unchanged', () {
      const original = InvitationException('already mapped');
      expect(mapToInvitationException(original), same(original));
    });

    test('preserves the status code from a NetworkException', () {
      const error = NetworkException(message: 'Invitation already accepted', statusCode: 409);
      final result = mapToInvitationException(error);

      expect(result.message, 'Invitation already accepted');
      expect(result.statusCode, 409);
    });

    test('falls back to a generic message for any other error type', () {
      expect(
        mapToInvitationException(StateError('boom')).message,
        'Unable to complete this invitation request.',
      );
    });
  });
}

Map<String, dynamic> _invitationJson({required String? status, DateTime? expiresAt}) {
  return {
    'id': 'invite-1',
    'organizationId': 'org-1',
    'email': 'new@example.com',
    'roleId': 'role-1',
    'roleName': 'Member',
    'status': status,
    'invitedByUserId': 'user-1',
    'invitedByName': 'Owner',
    'expiresAt': (expiresAt ?? DateTime(2999, 1, 1)).toIso8601String(),
    'createdAt': DateTime(2026, 1, 1).toIso8601String(),
  };
}

Map<String, dynamic> _organizationJson({String? onboardingCompletedAt}) {
  return {
    'id': 'org-1',
    'name': 'Acme',
    'slug': 'acme',
    'onboardingCompletedAt': onboardingCompletedAt,
  };
}
