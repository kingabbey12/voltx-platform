/// User profile returned by the users API.
class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.status,
    required this.emailVerified,
    this.avatarUrl,
    this.phoneNumber,
    this.jobTitle,
    this.lastLoginAt,
    this.createdAt,
    this.updatedAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      emailVerified: json['emailVerifiedAt'] != null,
      avatarUrl: json['avatarUrl'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      jobTitle: json['jobTitle'] as String?,
      lastLoginAt: json['lastLoginAt'] as String?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String status;
  final bool emailVerified;
  final String? avatarUrl;
  final String? phoneNumber;
  final String? jobTitle;
  final String? lastLoginAt;
  final String? createdAt;
  final String? updatedAt;

  String get displayName => '$firstName $lastName'.trim();

  UserProfile copyWith({
    String? firstName,
    String? lastName,
    String? avatarUrl,
    String? phoneNumber,
    String? jobTitle,
    bool? emailVerified,
  }) {
    return UserProfile(
      id: id,
      email: email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      status: status,
      emailVerified: emailVerified ?? this.emailVerified,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      jobTitle: jobTitle ?? this.jobTitle,
      lastLoginAt: lastLoginAt,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

class UserException implements Exception {
  const UserException(this.message);

  final String message;

  @override
  String toString() => message;
}
