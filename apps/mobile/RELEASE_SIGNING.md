# Android release signing

How the Voltx production Android App Bundle is signed for Google Play, where the upload key
lives, and how to rebuild a release.

## Where the keystore is stored

The upload keystore is **not** stored inside this repository. It lives at:

```
~/.voltx-release-keys/voltx-upload-keystore.jks
```

on the machine it was generated on, with `0600` permissions (owner read/write only) on both the
keystore file and its containing directory. `android/key.properties` (also `0600`, gitignored —
see `android/.gitignore`) points `storeFile` at this absolute path and holds the store/key
password and key alias (`upload`) that `android/app/build.gradle.kts` reads to sign release
builds. Neither file is, or should ever be, committed.

Keeping the keystore outside the project directory is deliberate: it can't be swept into a
`git add -A`/`git add -f`, and it isn't lost if the repo clone is deleted.

**Key details** (safe to record — none of this is secret):
- Alias: `upload`
- Algorithm: RSA 2048, SHA384withRSA
- Validity: 10,000 days from generation (until 2053-11-22)
- SHA-1: `2B:5A:A4:99:A4:B0:52:5B:55:1D:1C:E6:B8:1F:8D:43:B9:F8:ED:F6`
- SHA-256: `B9:1B:C8:9A:A7:A0:26:7F:E4:C8:11:DC:9D:CE:5E:22:88:6F:DF:84:B2:AB:EA:DA:DF:1A:5B:96:79:50:45:DF`

These fingerprints are what you register in Play Console (App integrity / App signing) and any
other service that needs to verify uploads come from this key (e.g. Firebase, OAuth client
restrictions). Regenerate them anytime with:

```bash
keytool -list -v -keystore ~/.voltx-release-keys/voltx-upload-keystore.jks -alias upload
```

## Backing it up

**Losing this keystore means you can never again upload an update to the same Play Store
listing under this app's identity — Google cannot recover or reset it for you.** Treat it like
any other irreplaceable credential:

1. Copy `~/.voltx-release-keys/voltx-upload-keystore.jks` into a password manager that supports
   file attachments (1Password, Bitwarden, etc.), or an encrypted archive stored in at least two
   independent locations (e.g. encrypted cloud storage + an offline drive).
2. Store the store/key password (in `android/key.properties`, `storePassword`/`keyPassword` —
   both fields hold the same value, since modern PKCS12 keystores don't support separate
   store/key passwords) in the same password manager, as its own entry — don't rely on
   `key.properties` being the only copy.
3. If more than one engineer builds release artifacts, share the keystore + password through the
   password manager's secure sharing, not email/Slack/git.
4. Re-run the `keytool -list -v` command above after restoring from any backup to confirm the
   fingerprints still match the ones recorded above before trusting the restored file.

## Rebuilding the release AAB

```bash
cd apps/mobile
flutter clean
flutter build appbundle \
  --release \
  --flavor production \
  -t lib/main_production.dart
```

Output: `build/app/outputs/bundle/productionRelease/app-production-release.aab`.

`flutter clean` first is recommended, not optional — Gradle/AOT build caching has been observed
to silently reuse a stale compiled snapshot across source changes; a clean build is the only way
to be sure the artifact reflects the current source.

To confirm an AAB is actually signed with the upload key (and not silently falling back to debug
signing, which happens automatically if `android/key.properties` is missing — see
`android/app/build.gradle.kts`):

```bash
jarsigner -verify -verbose -certs build/app/outputs/bundle/productionRelease/app-production-release.aab \
  | grep "CN="
```

This should show `CN=Voltx, OU=Engineering, O=Voltx Inc, ...` on every signed entry. If it shows
a debug cert instead, `android/key.properties` is missing or not being picked up.

## If the keystore is lost or compromised

There is no recovery path for a lost upload key on an already-published Play Store listing other
than contacting Google Play support to request an upload key reset, which is a manual,
non-guaranteed process. If the key is compromised (leaked, stolen), rotate it immediately via
Play Console's upload key reset flow and revoke trust in the old key. Prevention (the backup
steps above) is far cheaper than recovery.
