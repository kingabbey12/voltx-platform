import '../models/user_profile.dart';
import '../services/user_api_service.dart';

abstract class UserRepository {
  Future<UserProfile> getCurrentUser();
  Future<UserProfile> updateProfile({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    String? phoneNumber,
    String? jobTitle,
  });
}

class ApiUserRepository implements UserRepository {
  ApiUserRepository(this._apiService);

  final UserApiService _apiService;

  @override
  Future<UserProfile> getCurrentUser() async {
    try {
      return await _apiService.getCurrentUser();
    } catch (error) {
      throw mapToUserException(error);
    }
  }

  @override
  Future<UserProfile> updateProfile({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    String? phoneNumber,
    String? jobTitle,
  }) async {
    try {
      return await _apiService.updateProfile(
        firstName: firstName,
        lastName: lastName,
        avatarUrl: avatarUrl,
        phoneNumber: phoneNumber,
        jobTitle: jobTitle,
      );
    } catch (error) {
      throw mapToUserException(error);
    }
  }
}
