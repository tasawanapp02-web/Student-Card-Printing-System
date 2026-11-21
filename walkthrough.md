# Security Summary

**Reviewed Files**: 42
**Issues Resolved**: 5

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Hardcoded Admin Password & Auto-Provisioning | `src/utils/defaultData.ts`, `src/utils/storage.ts`, `src/types/index.ts` | 372 / 3147 | A plaintext admin password (`213894120`) was stored in client-side source code and used to auto-create the admin account on first sign-in. | Critical | Fixed | Removed the hardcoded password field from `UserAccount` and `SYSTEM_ADMIN_RECOVERY`, emptied `INITIAL_USERS`, and removed client-side auto-provisioning so sign-in strictly delegates to Firebase Authentication. |
| Unauthenticated Print Preview & Leftover Cache | `src/App.tsx`, `src/utils/storage.ts` | 90 / 542 | Opening `?printPreview=front|back|photo|registry` bypassed the sign-in screen and could render cached student/guardian PII; logout also left `spc_print_preview_payload_v1` in local storage. | High | Fixed | Required an authenticated `currentUser` before rendering `PrintPreviewTab` (showing `LoginModal` first if unauthenticated) and cleared `PRINT_PREVIEW_PAYLOAD` on logout and factory reset. |
| Inactive Account Session Enforcement | `src/App.tsx`, `src/utils/storage.ts` | 43 / 622 | Accounts marked `isActive: false` were only blocked during fresh password sign-in, allowing existing sessions or Google sign-ins to remain active. | Medium-High | Fixed | Enforced `isActive` checks on initial sync completion, Google sign-in, session restore (`onAuthStateChanged`), and live Firestore profile updates, signing out and wiping local caches immediately when deactivated. |
| Unsanitized SVG Uploads & Unsafe Image URLs | `src/utils/imageOptimizer.ts`, `src/utils/storage.ts` | 244 / 1681 | Uploaded SVG files were persisted verbatim without stripping `<script>`, event handlers (`on*`), `<foreignObject>`, or external `href` attributes, and `resolveImageSrc` returned unvalidated URL schemes. | Medium | Fixed | Added upload size/MIME validation, strict DOM-based SVG sanitization stripping active scripts, handlers, and non-fragment URIs, and scheme allowlisting (`https:`, `blob:`, `firestore-asset:`, and safe `data:image/*`) across `resolveImageSrc` and Firestore asset persistence. |
| Input Bounds & CSV Import Validation | `src/components/StudentsView.tsx`, `src/components/GuardiansView.tsx` | 326 / 287 | Student, guardian, and CSV import fields lacked control-character stripping, phone format validation, and client-side length/size caps matching Firestore rules. | Low-Medium | Fixed | Added control-character stripping, field length caps, `entryYear` bounds (`2500..2700`), guardian phone format validation, `maxLength` attributes, and CSV payload/row limits (2 MB / 5,000 rows). |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Firebase Rules & Database Access | `firestore.rules`, `storage.rules` | Enforces default-deny across all collections and Storage paths, requires signed-in Firebase users, isolates non-admin reads/writes by `ownerId`, validates strict field allowlists and types, and preserves immutable `print_history` logs. |
| Secrets & Environment Configuration | `.env.example`, `firebase-applet-config.json`, `src/firebase.ts` | Contains no private API keys, OAuth secrets, or database passwords; `firebase-applet-config.json` contains only public Firebase Web App identifiers while access is enforced by Firebase Auth and security rules. |
| DOM XSS Protection | `src/components/*` | All user-supplied values render through React JSX text bindings with zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic script execution. |
| HTTPS & External Links | `index.html`, `src/components/*` | All external fonts, Firebase endpoints, and console links use `https://` exclusively, and external links open with `rel="noreferrer"`. |
| AI & Agent Operations | `src/` | Verified zero imports of `@google/genai`, zero LLM calls, and zero `/api/*` agent endpoints exist in runtime source code; template references in `metadata.json` and `.env.example` are inactive, eliminating prompt-injection and AI PII leakage paths. |

---

## PoC Verification

### 1. Hardcoded Admin Password & Auto-Provisioning Removal

#### Summary
| Field | Value |
|---|---|
| Issue Type | Exposed Credential / Authentication Bypass |
| Impact | Critical |
| Affected File | `src/utils/defaultData.ts:372`, `src/utils/storage.ts:3200` |
| Test Scenario | Attempt to authenticate as `admin` / `admin@pcccr.ac.th` using the formerly embedded `213894120` credential or trigger client-side `createUserWithEmailAndPassword` auto-provisioning. |

#### How It Was Fixed
Removed the plaintext `password` property from `UserAccount` and `SYSTEM_ADMIN_RECOVERY`, emptied `INITIAL_USERS`, and removed the `isDefaultAdminMatch` / `createUserWithEmailAndPassword` fallback inside `loginWithUsernameAndPassword`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Caller invokes `loginWithUsernameAndPassword('admin', '<password>')` | Input enters `src/utils/storage.ts:3200` |
| 2 | `resolveLoginEmail` maps `admin` to `admin@pcccr.ac.th` and passes credentials directly to `signInWithEmailAndPassword(auth, resolvedEmail, password)` at `src/utils/storage.ts:3211` | No local password comparison or auto-create branch exists |
| 3 | Firebase Authentication validates credentials server-side | **Handled Safely** — unauthenticated/invalid passwords are rejected with `auth/invalid-credential` |

#### Conclusion
**Fix Verified** - No hardcoded password exists in the bundle and account provisioning is restricted to authenticated admin sessions in Settings.

---

### 2. Unauthenticated Print Preview Route & Logout Cache Cleanup

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Sign-In Check & Sensitive Cache Retention |
| Impact | High |
| Affected File | `src/App.tsx:89`, `src/utils/storage.ts:544` |
| Test Scenario | Navigate unauthenticated to `/?printPreview=front` while `spc_print_preview_payload_v1` or cached records remain in browser storage after logout. |

#### How It Was Fixed
Authenticated user state (`currentUser`) is checked before rendering `PrintPreviewTab`, rendering `LoginModal` for unauthenticated requests, and `stopRealtimeSync(true)` / `resetToFactoryDefaults()` now delete `STORAGE_KEYS.PRINT_PREVIEW_PAYLOAD`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated browser requests `/?printPreview=front` | `App` evaluates `isPrintPreviewMode` at `src/App.tsx:84` |
| 2 | `if (isPrintPreviewMode)` checks `if (!currentUser)` at `src/App.tsx:90` | Renders `LoginModal` instead of `PrintPreviewTab` |
| 3 | Previously logged-out sessions ran `stopRealtimeSync(true)` at `src/utils/storage.ts:544` | `PRINT_PREVIEW_PAYLOAD` and all cached PII keys were deleted (`removeItem`) |
| 4 | Only after Firebase Auth succeeds does `currentUser` populate and allow `PrintPreviewTab` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unauthenticated visitors cannot view or print card/guardian/student PII via `?printPreview=` query parameters.

---

### 3. Inactive Operator (`isActive: false`) Session Revocation

#### Summary
| Field | Value |
|---|---|
| Issue Type | Stale Session / Insufficient Authorization Enforcement |
| Impact | Medium-High |
| Affected File | `src/App.tsx:43`, `src/App.tsx:136`, `src/utils/storage.ts:622`, `src/utils/storage.ts:3189` |
| Test Scenario | An already signed-in operator or Google user has their `operator_accounts/{uid}` document updated to `isActive: false`. |

#### How It Was Fixed
Added `isActive` validation across `initRealtimeSync`, `loginWithGoogle`, `onAuthStateChanged` in `App.tsx`, and the live `storageService.subscribe` listener so deactivated operators are immediately signed out and have local caches cleared.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Firestore pushes `isActive: false` on `operator_accounts/{uid}` to the `selfOperator` listener | `currentOperatorProfile.isActive` becomes `false` (`src/utils/storage.ts:906`) |
| 2 | Initial sync checks `if (this.currentOperatorProfile?.isActive === false)` (`src/utils/storage.ts:622`) and live updates trigger `App.tsx:136` | Calls `signOut(auth)`, `stopRealtimeSync(true)`, and clears `currentUser` |
| 3 | UI immediately returns to `LoginModal` with a deactivation notice | **Handled Safely** |

#### Conclusion
**Fix Verified** - Deactivated staff accounts lose access immediately upon reload, sign-in, or live profile update.

---

### 4. Malicious SVG Upload & Unsafe Image URL Scheme Blocking

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Site Scripting via SVG Upload / Unvalidated URL Scheme |
| Impact | Medium |
| Affected File | `src/utils/imageOptimizer.ts:190`, `src/utils/storage.ts:136`, `src/utils/storage.ts:1685` |
| Test Scenario | Upload a crafted `.svg` containing `<svg onload="alert(1)"><script>fetch('https://evil.test')</script><foreignObject></foreignObject></svg>` or pass `javascript:alert(1)` into an image reference. |

#### How It Was Fixed
Added `validateImageUploadFile` (MIME + 20 MB cap), `sanitizeSvgContent` (DOM XML parser stripping dangerous tags, `on*` event attributes, external `href`/`xlink:href` links, and unsafe CSS expressions), and `isSafeImageSrc` scheme allowlisting in `resolveImageSrc`, `getImageFallbackDataUrl`, and Firestore persistence.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Malicious `.svg` file enters `compressCardImage` / `compressAvatarPhoto` | Passes size/MIME check and enters `processSvgFile` -> `sanitizeSvgContent` (`src/utils/imageOptimizer.ts:220`) |
| 2 | `DOMParser` parses XML; `<script>` and `<foreignObject>` are removed, and `onload` attribute is stripped | Clean SVG markup is re-serialized |
| 3 | Any `javascript:` or `data:text/html` URL passed to `resolveImageSrc` enters `isSafeImageSrc` (`src/utils/storage.ts:153`) | Fails allowlist check and returns `''` |
| 4 | Final rendered/persisted image reference | **Handled Safely** |

#### Conclusion
**Fix Verified** - Embedded scripts, event handlers, and non-image URI schemes are stripped or rejected before storage and rendering.

---

### 5. Form & CSV Batch Import Input Validation

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unbounded Input / Control-Character Injection |
| Impact | Low-Medium |
| Affected File | `src/components/StudentsView.tsx:326`, `src/components/StudentsView.tsx:387`, `src/components/GuardiansView.tsx:289` |
| Test Scenario | Paste >5,000 CSV lines, oversized names (>120 chars), out-of-range Buddhist years, control characters (`\x00`), or invalid characters into guardian phone fields. |

#### How It Was Fixed
Enforced `maxLength` HTML constraints matching Firestore schema rules, stripped ASCII control characters, bounded `entryYear` to `2500..2700`, validated guardian phone characters, and capped CSV parsing to 2 MB / 5,000 rows.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Oversized CSV or malformed form values enter `handleParseCsv`, `handleSaveStudent`, or `handleSaveGuardian` | Payload truncated to safe bounds (`2 MB` / `5,000` rows) |
| 2 | `stripCtrl` / `cleanText` removes control chars and enforces field max lengths; phone regex checks valid characters | Invalid phone rejected with notification; fields bounded to schema limits |
| 3 | `persistStudentDoc` and `persistGuardianDoc` (`src/utils/storage.ts:1330`) re-apply sanitization before Firestore write | **Handled Safely** |

#### Conclusion
**Fix Verified** - Client-side forms and batch CSV imports cleanly enforce length, format, and size constraints aligned with Firestore security rules.
