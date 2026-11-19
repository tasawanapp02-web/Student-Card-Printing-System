/**
 * Security Rule Test Vectors (Phase 0: Dirty Dozen Payloads & Invariant Assertions)
 * Mirrors the exact structural and volumetric constraints enforced in firestore.rules
 * and firebase-blueprint.json.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'list' | 'delete';
  auth: {
    uid: string;
    email?: string;
    emailVerified: boolean;
    signInProvider?: 'google.com' | 'password';
  } | null;
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_VECTORS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Student Create',
    collection: 'students',
    docId: '50101',
    operation: 'create',
    auth: null,
    payload: {
      studentId: '50101',
      ownerId: 'anon',
      prefix: 'เด็กชาย',
      firstName: 'ทดสอบ',
      lastName: 'ระบบ',
      level: 'มัธยมศึกษาตอนต้น',
      classroom: '1',
      entryYear: 2569,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof (Even via Password Provider)',
    collection: 'system_settings',
    docId: 'school_config',
    operation: 'create',
    auth: {
      uid: 'spoof_uid',
      email: 'tasawan_app02@pcccr.ac.th',
      emailVerified: false,
      signInProvider: 'password',
    },
    payload: {
      ownerId: 'spoof_uid',
      academicYear: 2569,
      trayConfig: {},
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Privilege Escalation',
    collection: 'admins',
    docId: 'attacker_uid',
    operation: 'create',
    auth: {
      uid: 'attacker_uid',
      email: 'attacker@example.com',
      emailVerified: true,
    },
    payload: {
      role: 'admin',
      email: 'attacker@example.com',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Guardian Create',
    collection: 'guardians',
    docId: 'guard_spoof_1',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      id: 'guard_spoof_1',
      ownerId: 'user_b',
      prefix: 'นาย',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      relation: 'บิดา',
      photoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/g.jpg',
      photoFileName: 'g.jpg',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow / Ghost Field Injection (incl. Password Storage Attempt)',
    collection: 'operator_accounts',
    docId: 'op_ghost_1',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@pcccr.ac.th',
      emailVerified: false,
      signInProvider: 'password',
    },
    payload: {
      id: 'op_ghost_1',
      ownerId: 'user_a',
      uid: 'op_ghost_1',
      username: 'staff01',
      email: 'staff01@pcccr.ac.th',
      fullName: 'เจ้าหน้าที่ 01',
      position: 'เจ้าหน้าที่',
      role: 'admin',
      isActive: true,
      password: 'plaintext_forbidden_field',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Document ID Poisoning (Path Traversal / Oversize)',
    collection: 'front_designs',
    docId: 'bad..id$with#invalidChars',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      id: 'bad..id$with#invalidChars',
      ownerId: 'user_a',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Temporal Forgery (Client String Timestamp Instead of serverTimestamp)',
    collection: 'students',
    docId: '50102',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      studentId: '50102',
      ownerId: 'user_a',
      prefix: 'เด็กหญิง',
      firstName: 'มานี',
      lastName: 'รักเรียน',
      level: 'มัธยมศึกษาตอนต้น',
      classroom: '2',
      entryYear: 2569,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable ownerId Hijack on Update',
    collection: 'cards',
    docId: 'card_50101_01',
    operation: 'update',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      ownerId: 'user_b',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning (Oversized Array & Base64 Injection)',
    collection: 'back_designs',
    docId: 'design_back_poison',
    operation: 'update',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      rules: Array.from({ length: 25 }, (_, i) => `Rule ${i + 1}`),
      bgImageUrl: 'data:image/png;base64,' + 'A'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Card Creation Without Existing Student/Guardian',
    collection: 'cards',
    docId: 'card_99999_0001',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      id: 'card_99999_0001',
      ownerId: 'user_a',
      studentId: '99999',
      guardianId: 'nonexistent_guardian',
      issueDate: '2026-05-15',
      expiryDate: '2029-03-31',
      status: 'active',
      qrCodeText: 'CARD:99999:nonexistent_guardian',
      printCount: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Bypass on Revoked PickupCard',
    collection: 'cards',
    docId: 'card_50101_revoked',
    operation: 'update',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'PII Blanket Query Without Owner Filter',
    collection: 'guardians',
    docId: '*',
    operation: 'list',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Oversized ImageAsset Data URL (> 800,000 chars) Rejected',
    collection: 'image_assets',
    docId: 'img_oversized_1',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      id: 'img_oversized_1',
      ownerId: 'user_a',
      category: 'front_bg',
      fileName: 'huge.png',
      contentType: 'image/png',
      width: 1200,
      height: 760,
      originalSize: 2000000,
      compressedSize: 900000,
      storageBackend: 'firestore',
      dataUrl: 'data:image/png;base64,' + 'A'.repeat(850000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Oversized Title & Shadow Field on PrintHeaderPreset',
    collection: 'print_headers',
    docId: 'hdr_poison_1',
    operation: 'create',
    auth: {
      uid: 'user_a',
      email: 'user_a@example.com',
      emailVerified: true,
    },
    payload: {
      id: 'hdr_poison_1',
      ownerId: 'user_a',
      title: 'H'.repeat(500),
      extraGhost: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
