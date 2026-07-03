import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../constants/user_constants.dart';
import '../models/user_profile.dart';

class UserApiService {
  UserApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<UserProfile> getCurrentUser() async {
    return _apiClient.get(
      UserApiPaths.me,
      fromJson: UserProfile.fromJson,
    );
  }

  Future<UserProfile> updateProfile({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    String? phoneNumber,
    String? jobTitle,
  }) async {
    return _apiClient.patch(
      UserApiPaths.me,
      data: {
        'firstName': ?firstName,
        'lastName': ?lastName,
        'avatarUrl': ?avatarUrl,
        'phoneNumber': ?phoneNumber,
        'jobTitle': ?jobTitle,
      },
      fromJson: UserProfile.fromJson,
    );
  }
}

UserException mapToUserException(Object error) {
  if (error is UserException) {
    return error;
  }
  if (error is NetworkException) {
    return UserException(error.message);
  }
  return const UserException('Unable to complete profile request.');
}
