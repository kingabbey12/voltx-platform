# R8/ProGuard rules for release builds (minifyEnabled/shrinkResources — see
# app/build.gradle.kts). Flutter's own engine/plugin embedding classes ship
# their own consumer-rules.pro bundled in their AARs and don't need
# repeating here; these are the app-level rules that don't come for free.

# The Flutter engine references Play Core's deferred-components (dynamic
# feature module) classes reflectively for split-install support, even
# though this app doesn't use deferred components and doesn't depend on
# play-core at all. Without that dependency on the classpath, R8 treats the
# reference as a missing class and fails the build unless told it's fine
# for these specific classes to be absent at runtime.
-dontwarn com.google.android.play.core.**

# Keep enough debug info for de-obfuscatable stack traces once Sentry's
# mapping file is uploaded for a release build (see sentry_flutter).
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
