# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Identity & Auth Provider Verification**: Every read, list, create, update, and delete operation requires `request.auth != null` AND either `request.auth.token.email_verified == true` (e.g., Google Sign-In) OR `request.auth.token.firebase.sign_in_provider == 'password'` (Firebase Email/Password Auth). Unauthenticated clients and unverified non-password tokens receive `PERMISSION_DENIED`. Bootstrapped admin privilege (`tasawan_app02@pcccr.ac.th`) ALWAYS strictly requires `request.auth.token.email_verified == true` to prevent email spoofing.
2. **Ownership & RBAC Isolation**:
   - Every document in `system_settings`, `front_designs`, `back_designs`, `students`, `guardians`, `cards`, `print_history`, `operator_accounts`, `image_assets`, and `print_headers` MUST store `ownerId == request.auth.uid` on creation.
   - `ownerId` and `createdAt` are **immortal/immutable** after creation.
   - Only the document owner (`resource.data.ownerId == request.auth.uid`) or a verified admin (`admins/{uid}` or verified bootstrapped email `tasawan_app02@pcccr.ac.th`) may read, update, or delete records.
   - Non-bootstrapped users cannot read or list another user's PII (`guardians.phone`, `students`, `cards`, `print_history`, `operator_accounts`) or uploaded `image_assets`.
   - Users cannot self-assign admin privileges in `/admins/{uid}` and `operator_accounts` NEVER store plaintext passwords.
3. **Referential Integrity**:
   - A `PickupCard` in `/cards/{cardId}` MUST reference an existing `Student` in `/students/{studentId}` and an existing `Guardian` in `/guardians/{guardianId}` at creation time.
   - A `revoked` `PickupCard` reaches a terminal state and cannot be modified by non-admin users.
4. **Temporal Integrity**:
   - `createdAt` MUST equal `request.time` on document creation.
   - `updatedAt` MUST equal `request.time` on creation and every update.
5. **Volumetric & Schema Integrity (Anti-Shadow-Field & Anti-Base64-Bloat)**:
   - Every document ID MUST match `^[a-zA-Z0-9_-]{1,128}$` (and `studentId` MUST match `^[0-9]{5}$`).
   - Every string field enforces strict `.size()` upper bounds (Firebase Storage HTTPS URLs or `firestore-asset://` refs `<= 2048` chars on parent docs; `bgImageUrl` `<= 10000` chars to allow compact default SVG patterns while blocking multi-hundred-KB base64 blobs on design docs).
   - Dedicated `/image_assets/{assetId}` docs strictly compress and bound `dataUrl` `<= 800000` chars (always < 1 MiB Firestore document cap) and validate `category`, `contentType`, and pixel bounds.
   - Strict `hasAll` and `hasOnly` key checks on create, and `affectedKeys().hasOnly(...)` action gates on update.
   - `print_history` logs are append-only (`allow update: if false`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Write**: Creating `/students/50101` with `auth = null`. -> `PERMISSION_DENIED`
2. **Unverified Admin Email Spoof**: Creating `/system_settings/school_config` with `auth.token.email = "tasawan_app02@pcccr.ac.th"` and `auth.token.email_verified = false` (even via password provider). -> `PERMISSION_DENIED`
3. **Self-Assigned Admin Privilege Escalation**: Non-admin user creating `/admins/<their_uid>` with `{ role: "admin" }`. -> `PERMISSION_DENIED`
4. **Identity Spoofing on Create**: User `uid_A` creating `/guardians/guard_1` with `ownerId: "uid_B"`. -> `PERMISSION_DENIED`
5. **Shadow / Ghost Field Injection (incl. Password Leak)**: Creating `/front_designs/d1` with `isVerified: true` or `/operator_accounts/op_1` with `password: "secret"`. -> `PERMISSION_DENIED`
6. **Document ID Poisoning**: Creating `/front_designs/bad..id$1234` or a 200-char ID. -> `PERMISSION_DENIED`
7. **Temporal Forgery**: Creating `/students/50101` with client-forged `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` (`request.time`). -> `PERMISSION_DENIED`
8. **Immutable Field Hijack on Update**: Updating `/cards/card_1` to reassign `ownerId` or alter `createdAt`. -> `PERMISSION_DENIED`
9. **Value Poisoning / Type Mismatch on Update**: Updating `/back_designs/b1` with `rules: ["x", ... 25 items]` (exceeding max list size 12) or `bgImageUrl` > 2048 chars. -> `PERMISSION_DENIED`
10. **Orphaned Card Creation**: Creating `/cards/card_orphan` referencing non-existent `/students/99999` or `/guardians/missing_g`. -> `PERMISSION_DENIED`
11. **Terminal State Bypass**: Non-admin attempting to update a `PickupCard` whose existing `status` is `"revoked"` back to `"active"`. -> `PERMISSION_DENIED`
12. **PII Blanket Scraping (List Without Owner Filter)**: User `uid_A` running `getDocs(collection(db, "guardians"))` without filtering `where("ownerId", "==", "uid_A")`. -> `PERMISSION_DENIED`
