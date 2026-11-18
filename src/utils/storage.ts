import {
  Student,
  Guardian,
  PickupCard,
  CardDesignConfig,
  BackCardDesignConfig,
  TrayCalibrationConfig,
  UserAccount,
  PrintHistoryItem,
  FirebaseConfigState,
  EducationLevel,
  PrintPreviewPayload,
  OperatorAccount,
  ImageAsset,
  ImageAssetCategory,
  ImageAssetReference,
  FirestoreUsageSummary,
  FirestoreUsageBreakdownItem,
} from '../types';
import {
  DEFAULT_TRAY_CONFIG,
  DEFAULT_JUNIOR_DESIGN,
  DEFAULT_SENIOR_DESIGN,
  DEFAULT_BACK_CARD_DESIGN,
  INITIAL_USERS,
  SYSTEM_ADMIN_RECOVERY,
} from './defaultData';
import {
  compressCardImage,
  compressAvatarPhoto,
  dataUrlToFile,
  MAX_FIRESTORE_DATAURL_CHARS,
  type CompressedImageResult,
} from './imageOptimizer';
import {
  db,
  storage,
  auth,
  firebaseConfig,
  ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';

const STORAGE_KEYS = {
  STUDENTS: 'spc_students_v1',
  GUARDIANS: 'spc_guardians_v1',
  CARDS: 'spc_cards_v1',
  JUNIOR_DESIGN: 'spc_junior_design_v1',
  SENIOR_DESIGN: 'spc_senior_design_v1',
  BACK_DESIGN: 'spc_back_design_v1',
  FRONT_DESIGNS: 'spc_front_designs_v1',
  BACK_DESIGNS: 'spc_back_designs_v1',
  TRAY_CONFIG: 'spc_tray_config_v1',
  CURRENT_USER: 'spc_current_user_v1',
  PRINT_HISTORY: 'spc_print_history_v1',
  PRINT_PREVIEW_PAYLOAD: 'spc_print_preview_payload_v1',
  ACADEMIC_YEAR: 'spc_academic_year_v1',
  DESIGNER_SAMPLE_PHOTO: 'spc_designer_sample_photo_v1',
  DESIGNER_SAMPLE_PHOTO_PATH: 'spc_designer_sample_photo_path_v1',
  DESIGNER_SAMPLE_PHOTO_ASSET_ID: 'spc_designer_sample_photo_asset_id_v1',
  IMAGE_ASSETS: 'spc_image_assets_v1',
  OPERATOR_ACCOUNTS: 'spc_operator_accounts_v1',
  REMEMBERED_USERNAME: 'spc_remembered_username_v1',
  CLEAN_PURGE_FLAG: 'spc_purge_mock_and_users_v2',
};

const IDB_NAME = 'spc_app_db_v1';
const IDB_STORE = 'kv_store';

function tsToIso(val: unknown, fallback?: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return fallback || new Date().toISOString();
}

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  return cleaned || `image_${Date.now()}.webp`;
}

function truncateStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.length > maxLen ? val.slice(0, maxLen) : val;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export interface UploadedImageSummary {
  url: string;
  storagePath: string;
  assetId: string;
  storageBackend: 'both' | 'storage' | 'firestore';
  originalSize: number;
  compressedSize: number;
  contentType: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface CloudSyncState {
  isCloudSynced: boolean;
  pendingWrites: number;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
  counts: {
    students: number;
    guardians: number;
    cards: number;
    frontDesigns: number;
    backDesigns: number;
    printHistory: number;
    imageAssets: number;
  };
}

class StorageService {
  private memoryCache = new Map<string, string>();
  private idbPromise: Promise<IDBDatabase | null> | null = null;
  private hydrationPromise: Promise<void> | null = null;

  // Subscriber listeners for React re-renders on Firestore sync
  private listeners = new Set<() => void>();

  // Active Firestore realtime sync state
  private activeUser: User | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private initialSyncPromise: Promise<void> | null = null;
  private isCloudSynced = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private pendingWriteCount = 0;
  private lastSyncError: string | null = null;
  private lastSyncedAt: string | null = null;

  // Track which doc IDs exist in Firestore to choose create (setDoc) vs update (updateDoc)
  private knownSystemSettings = false;
  private knownFrontDesignIds = new Set<string>();
  private knownBackDesignIds = new Set<string>();
  private knownStudentIds = new Set<string>();
  private knownGuardianIds = new Set<string>();
  private knownCardIds = new Set<string>();
  private knownHistoryIds = new Set<string>();
  private knownOperatorIds = new Set<string>();
  private knownImageAssetIds = new Set<string>();

  // Direct Firestore-backed operator accounts & image library state
  private cloudOperatorAccounts: OperatorAccount[] = [];
  private cloudImageAssets: ImageAsset[] = [];
  private currentOperatorProfile: OperatorAccount | null = null;
  private adminSeedPromise: Promise<void> | null = null;
  private storageAvailability: 'unknown' | 'available' | 'unavailable' = 'unknown';

  // --- SUBSCRIPTION ---
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Subscriber notification error:', e);
      }
    });
  }

  // --- INDEXEDDB + SAFE LOCALSTORAGE LAYER ---
  private openIdb(): Promise<IDBDatabase | null> {
    if (this.idbPromise) return this.idbPromise;
    if (typeof indexedDB === 'undefined') {
      this.idbPromise = Promise.resolve(null);
      return this.idbPromise;
    }

    this.idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const idb = req.result;
          if (!idb.objectStoreNames.contains(IDB_STORE)) {
            idb.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.idbPromise;
  }

  private async idbSet(key: string, value: string): Promise<void> {
    try {
      const idb = await this.openIdb();
      if (!idb) return;
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  private async idbDelete(key: string): Promise<void> {
    try {
      const idb = await this.openIdb();
      if (!idb) return;
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  public ready(): Promise<void> {
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = (async () => {
      try {
        const idb = await this.openIdb();
        if (idb) {
          await new Promise<void>((resolve) => {
            const tx = idb.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.openCursor();
            req.onsuccess = () => {
              const cursor = req.result;
              if (cursor) {
                if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
                  this.memoryCache.set(cursor.key, cursor.value);
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => resolve();
          });
        }
      } catch {
        // ignore
      }
      this.purgeLegacyMockData();
      this.removeItem(STORAGE_KEYS.OPERATOR_ACCOUNTS);
    })();

    return this.hydrationPromise;
  }

  private purgeLegacyMockData(): void {
    if (this.getItem(STORAGE_KEYS.CLEAN_PURGE_FLAG) === 'true') {
      return;
    }

    const mockStudentIds = new Set([
      '50101', '50102', '50103', '50104', '50105', '50106', '50107', '50108',
      '50201', '50202', '50203', '50204',
    ]);
    const mockGuardianIds = new Set(['guard_001', 'guard_002', 'guard_003', 'guard_004']);
    const mockCardIds = new Set([
      'card_50101_01', 'card_50101_02', 'card_50102_01', 'card_50201_01',
    ]);
    const mockHistoryIds = new Set(['hist_001', 'hist_002']);

    const filterJsonList = <T>(key: string, predicate: (item: T) => boolean): void => {
      const raw = this.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.setItem(key, JSON.stringify(parsed.filter(predicate)));
        }
      } catch {
        this.setItem(key, JSON.stringify([]));
      }
    };

    filterJsonList<Student>(STORAGE_KEYS.STUDENTS, (s) => !mockStudentIds.has(s.studentId));
    filterJsonList<Guardian>(STORAGE_KEYS.GUARDIANS, (g) => !mockGuardianIds.has(g.id));
    filterJsonList<PickupCard>(
      STORAGE_KEYS.CARDS,
      (c) =>
        !mockCardIds.has(c.id) &&
        !mockStudentIds.has(c.studentId) &&
        !mockGuardianIds.has(c.guardianId)
    );
    filterJsonList<PrintHistoryItem>(
      STORAGE_KEYS.PRINT_HISTORY,
      (h) => !mockHistoryIds.has(h.id) && !mockCardIds.has(h.cardId)
    );

    this.setItem(STORAGE_KEYS.CLEAN_PURGE_FLAG, 'true');
  }

  private getItem(key: string): string | null {
    const cached = this.memoryCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const lsVal = localStorage.getItem(key);
      if (lsVal !== null) {
        this.memoryCache.set(key, lsVal);
      }
      return lsVal;
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: string): void {
    this.memoryCache.set(key, value);
    void this.idbSet(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }

  private removeItem(key: string): void {
    this.memoryCache.delete(key);
    void this.idbDelete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  // --- FIREBASE STATUS & CONFIG ---
  public isAuthorizedFirebaseUser(user: User | null): boolean {
    if (!user) return false;
    const isPasswordUser = user.providerData.some((p) => p.providerId === 'password');
    return Boolean(user.emailVerified || isPasswordUser);
  }

  public getFirebaseStatus(): {
    isConfigured: boolean;
    isConnected: boolean;
    isAuthenticated: boolean;
    authMethod?: 'google' | 'password';
    projectId: string;
    databaseId: string;
    storageBucket: string;
    userEmail?: string | null;
    uid?: string | null;
  } {
    const fbUser = auth.currentUser;
    const isPassword = Boolean(fbUser?.providerData.some((p) => p.providerId === 'password'));
    return {
      isConfigured: true,
      isConnected: this.isCloudSynced || Boolean(fbUser),
      isAuthenticated: this.isAuthorizedFirebaseUser(fbUser),
      authMethod: fbUser ? (isPassword ? 'password' : 'google') : undefined,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      storageBucket: firebaseConfig.storageBucket,
      userEmail: fbUser?.email,
      uid: fbUser?.uid,
    };
  }

  public getFirebaseConfig(): FirebaseConfigState {
    return {
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      measurementId: firebaseConfig.measurementId,
      isConfigured: true,
    };
  }

  public async saveFirebaseConfig(_config: FirebaseConfigState): Promise<boolean> {
    // Provisioned config lives in firebase-applet-config.json
    return true;
  }

  // --- AUTH & REALTIME SYNC HELPERS ---
  private isUserBootstrappedAdmin(user: User | null): boolean {
    return Boolean(
      user &&
        user.emailVerified &&
        (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
  }

  private getSettingsDocId(user: User | null): string {
    if (!user) return 'school_config';
    return this.isUserBootstrappedAdmin(user) ? 'school_config' : sanitizeId(user.uid, 'cfg');
  }

  private getCurrentUid(): string | null {
    const user = this.activeUser || auth.currentUser;
    if (!this.isAuthorizedFirebaseUser(user)) return null;
    return user!.uid;
  }

  public getCloudSyncState(): CloudSyncState {
    return {
      isCloudSynced: this.isCloudSynced,
      pendingWrites: this.pendingWriteCount,
      lastSyncError: this.lastSyncError,
      lastSyncedAt: this.lastSyncedAt,
      counts: {
        students: this.getStudents().length,
        guardians: this.getGuardians().length,
        cards: this.getCards().length,
        frontDesigns: this.getFrontDesigns().length,
        backDesigns: this.getBackDesigns().length,
        printHistory: this.getPrintHistory().length,
        imageAssets: this.getImageAssets().length,
      },
    };
  }

  public clearSyncError(): void {
    this.lastSyncError = null;
    this.notifyListeners();
  }

  private enqueueWrite(task: () => Promise<void>): void {
    this.pendingWriteCount += 1;
    this.lastSyncError = null;
    this.notifyListeners();
    this.writeQueue = this.writeQueue
      .then(task)
      .then(() => {
        this.lastSyncedAt = new Date().toISOString();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Queued Firestore write error:', err);
        this.lastSyncError = msg;
      })
      .finally(() => {
        this.pendingWriteCount = Math.max(0, this.pendingWriteCount - 1);
        this.notifyListeners();
      });
  }

  public stopRealtimeSync(clearUserCache = false): void {
    this.unsubscribers.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
    this.unsubscribers = [];
    this.activeUser = null;
    this.isCloudSynced = false;
    this.initialSyncPromise = null;
    this.pendingWriteCount = 0;
    this.lastSyncError = null;
    this.knownSystemSettings = false;
    this.knownFrontDesignIds.clear();
    this.knownBackDesignIds.clear();
    this.knownStudentIds.clear();
    this.knownGuardianIds.clear();
    this.knownCardIds.clear();
    this.knownHistoryIds.clear();
    this.knownOperatorIds.clear();
    this.knownImageAssetIds.clear();
    this.cloudOperatorAccounts = [];
    this.cloudImageAssets = [];
    this.currentOperatorProfile = null;
    this.adminSeedPromise = null;
    this.removeItem(STORAGE_KEYS.OPERATOR_ACCOUNTS);

    if (clearUserCache) {
      this.removeItem(STORAGE_KEYS.STUDENTS);
      this.removeItem(STORAGE_KEYS.GUARDIANS);
      this.removeItem(STORAGE_KEYS.CARDS);
      this.removeItem(STORAGE_KEYS.PRINT_HISTORY);
      this.removeItem(STORAGE_KEYS.FRONT_DESIGNS);
      this.removeItem(STORAGE_KEYS.BACK_DESIGNS);
      this.removeItem(STORAGE_KEYS.IMAGE_ASSETS);
      this.removeItem(STORAGE_KEYS.TRAY_CONFIG);
      this.removeItem(STORAGE_KEYS.ACADEMIC_YEAR);
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO);
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID);
    }
  }

  public async initRealtimeSync(user: User | null): Promise<void> {
    await this.ready();

    if (!this.isAuthorizedFirebaseUser(user) || !user) {
      this.stopRealtimeSync(false);
      return;
    }

    if (this.activeUser?.uid === user.uid && this.unsubscribers.length > 0 && this.initialSyncPromise) {
      return this.initialSyncPromise;
    }

    const switchingUsers = Boolean(this.activeUser && this.activeUser.uid !== user.uid);
    this.stopRealtimeSync(switchingUsers);
    this.activeUser = user;

    const isAdminUser = this.isUserBootstrappedAdmin(user);
    const settingsDocId = this.getSettingsDocId(user);

    const buildQuery = (colName: string) => {
      const colRef = collection(db, colName);
      return isAdminUser ? colRef : query(colRef, where('ownerId', '==', user.uid));
    };

    const waitFlags = {
      settings: false,
      front: false,
      back: false,
      students: false,
      guardians: false,
      cards: false,
      history: false,
      operators: false,
      selfOperator: false,
      imageAssets: false,
    };

    let resolveInitial!: () => void;
    let rejectInitial!: (reason?: unknown) => void;
    this.initialSyncPromise = new Promise<void>((res, rej) => {
      resolveInitial = res;
      rejectInitial = rej;
    });

    const handleSyncError = (error: unknown, op: OperationType, path: string) => {
      if (!this.isCloudSynced) {
        rejectInitial(error);
      }
      handleFirestoreError(error, op, path);
    };

    const maybeFinishInitial = () => {
      if (
        waitFlags.settings &&
        waitFlags.front &&
        waitFlags.back &&
        waitFlags.students &&
        waitFlags.guardians &&
        waitFlags.cards &&
        waitFlags.history &&
        waitFlags.operators &&
        waitFlags.selfOperator &&
        waitFlags.imageAssets
      ) {
        if (!this.isCloudSynced) {
          this.isCloudSynced = true;
          this.lastSyncedAt = new Date().toISOString();
          resolveInitial();
          void this.seedAndMigrateToCloud(user).catch((err) => {
            console.error('Initial cloud seed error:', err);
            this.lastSyncError = err instanceof Error ? err.message : String(err);
            this.notifyListeners();
          });
        }
        this.notifyListeners();
      }
    };

    // 1. System Settings listener
    const settingsPath = `system_settings/${settingsDocId}`;
    this.unsubscribers.push(
      onSnapshot(
        doc(db, 'system_settings', settingsDocId),
        (snap) => {
          if (snap.exists()) {
            this.knownSystemSettings = true;
            const d = snap.data();
            if (typeof d.academicYear === 'number') {
              this.setItem(STORAGE_KEYS.ACADEMIC_YEAR, String(d.academicYear));
            }
            if (d.trayConfig && typeof d.trayConfig === 'object') {
              this.setItem(
                STORAGE_KEYS.TRAY_CONFIG,
                JSON.stringify({ ...DEFAULT_TRAY_CONFIG, ...d.trayConfig })
              );
            }
            if (typeof d.designerSamplePhotoUrl === 'string' && d.designerSamplePhotoUrl) {
              this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO, d.designerSamplePhotoUrl);
            } else {
              this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO);
            }
            if (typeof d.designerSamplePhotoPath === 'string' && d.designerSamplePhotoPath) {
              this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH, d.designerSamplePhotoPath);
            } else {
              this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
            }
            if (typeof d.designerSamplePhotoAssetId === 'string' && d.designerSamplePhotoAssetId) {
              this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID, d.designerSamplePhotoAssetId);
            } else {
              this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID);
            }
          } else {
            this.knownSystemSettings = false;
          }
          waitFlags.settings = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.GET, settingsPath);
        }
      )
    );

    // 2. Front Designs listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('front_designs'),
        (snap) => {
          this.knownFrontDesignIds.clear();
          const list: CardDesignConfig[] = [];
          snap.forEach((docSnap) => {
            this.knownFrontDesignIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push(
              this.normalizeFrontDesign({
                ...(raw as unknown as CardDesignConfig),
                id: docSnap.id,
                createdAt: tsToIso(raw.createdAt),
                updatedAt: tsToIso(raw.updatedAt),
              })
            );
          });
          if (list.length > 0) {
            this.setItem(STORAGE_KEYS.FRONT_DESIGNS, JSON.stringify(list));
          }
          waitFlags.front = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'front_designs');
        }
      )
    );

    // 3. Back Designs listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('back_designs'),
        (snap) => {
          this.knownBackDesignIds.clear();
          const list: BackCardDesignConfig[] = [];
          snap.forEach((docSnap) => {
            this.knownBackDesignIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push(
              this.normalizeBackDesign({
                ...(raw as unknown as BackCardDesignConfig),
                id: docSnap.id,
                createdAt: tsToIso(raw.createdAt),
                updatedAt: tsToIso(raw.updatedAt),
              })
            );
          });
          if (list.length > 0) {
            this.setItem(STORAGE_KEYS.BACK_DESIGNS, JSON.stringify(list));
          }
          waitFlags.back = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'back_designs');
        }
      )
    );

    // 4. Students listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('students'),
        (snap) => {
          this.knownStudentIds.clear();
          const list: Student[] = [];
          snap.forEach((docSnap) => {
            this.knownStudentIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as Student),
              studentId: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            });
          });
          list.sort((a, b) => a.studentId.localeCompare(b.studentId));
          this.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(list));
          waitFlags.students = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'students');
        }
      )
    );

    // 5. Guardians listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('guardians'),
        (snap) => {
          this.knownGuardianIds.clear();
          const list: Guardian[] = [];
          snap.forEach((docSnap) => {
            this.knownGuardianIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as Guardian),
              id: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            });
          });
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          this.setItem(STORAGE_KEYS.GUARDIANS, JSON.stringify(list));
          waitFlags.guardians = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'guardians');
        }
      )
    );

    // 6. Cards listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('cards'),
        (snap) => {
          this.knownCardIds.clear();
          const list: PickupCard[] = [];
          snap.forEach((docSnap) => {
            this.knownCardIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as PickupCard),
              id: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            });
          });
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          this.setItem(STORAGE_KEYS.CARDS, JSON.stringify(list));
          waitFlags.cards = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'cards');
        }
      )
    );

    // 7. Print History listener
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('print_history'),
        (snap) => {
          this.knownHistoryIds.clear();
          const list: PrintHistoryItem[] = [];
          snap.forEach((docSnap) => {
            this.knownHistoryIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as PrintHistoryItem),
              id: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
            });
          });
          list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          this.setItem(STORAGE_KEYS.PRINT_HISTORY, JSON.stringify(list));
          waitFlags.history = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'print_history');
        }
      )
    );

    // 8. Operator Accounts listener (stored directly in Firestore, never cached locally)
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('operator_accounts'),
        (snap) => {
          this.knownOperatorIds.clear();
          const list: OperatorAccount[] = [];
          snap.forEach((docSnap) => {
            this.knownOperatorIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as OperatorAccount),
              id: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            });
          });
          list.sort((a, b) => a.username.localeCompare(b.username));
          this.cloudOperatorAccounts = list;
          waitFlags.operators = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'operator_accounts');
        }
      )
    );

    // 9. Self Operator Profile listener (allows staff created by another admin to load their own doc)
    const selfOpPath = `operator_accounts/${user.uid}`;
    this.unsubscribers.push(
      onSnapshot(
        doc(db, 'operator_accounts', user.uid),
        (snap) => {
          if (snap.exists()) {
            this.knownOperatorIds.add(snap.id);
            const raw = snap.data() as Record<string, unknown>;
            this.currentOperatorProfile = {
              ...(raw as unknown as OperatorAccount),
              id: snap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            };
          } else {
            this.currentOperatorProfile = null;
          }
          waitFlags.selfOperator = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.GET, selfOpPath);
        }
      )
    );

    // 10. Image Assets Library listener (stored directly in Firestore for reliable reuse across devices)
    this.unsubscribers.push(
      onSnapshot(
        buildQuery('image_assets'),
        (snap) => {
          this.knownImageAssetIds.clear();
          const list: ImageAsset[] = [];
          snap.forEach((docSnap) => {
            this.knownImageAssetIds.add(docSnap.id);
            const raw = docSnap.data() as Record<string, unknown>;
            list.push({
              ...(raw as unknown as ImageAsset),
              id: docSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            });
          });
          list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          this.cloudImageAssets = list;
          this.setItem(STORAGE_KEYS.IMAGE_ASSETS, JSON.stringify(list));
          waitFlags.imageAssets = true;
          maybeFinishInitial();
          if (this.isCloudSynced) this.notifyListeners();
        },
        (error) => {
          handleSyncError(error, OperationType.LIST, 'image_assets');
        }
      )
    );

    return this.initialSyncPromise;
  }

  private async seedAndMigrateToCloud(user: User): Promise<void> {
    const uid = user.uid;

    // 0. Ensure 1 canonical copy of "ผู้ดูแลระบบ" exists in Firestore for the system admin account
    if ((user.email || '').toLowerCase() === SYSTEM_ADMIN_RECOVERY.email.toLowerCase()) {
      await this.ensureDefaultSystemAdminInFirestore(user);
    }

    // 1. Seed / migrate System Settings
    if (!this.knownSystemSettings) {
      let sampleUrl = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO) || '';
      let samplePath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '';
      let sampleAssetId = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '';
      if (sampleUrl && sampleUrl.startsWith('data:image/') && !sampleUrl.startsWith('data:image/svg+xml')) {
        const file = dataUrlToFile(sampleUrl, 'sample_guardian');
        if (file) {
          try {
            const uploaded = await this.uploadSamplePhoto(file);
            sampleUrl = uploaded.url;
            samplePath = uploaded.storagePath;
            sampleAssetId = uploaded.assetId;
          } catch {
            sampleUrl = '';
            samplePath = '';
            sampleAssetId = '';
          }
        }
      }
      await this.persistSystemSettingsToCloud(uid, {
        academicYear: this.getAcademicYear(),
        trayConfig: this.getTrayConfig(),
        designerSamplePhotoUrl: sampleUrl,
        designerSamplePhotoPath: samplePath,
        designerSamplePhotoAssetId: sampleAssetId,
      });
    }

    const isAdminUser = this.isUserBootstrappedAdmin(user);
    const scopeDefaultDesignId = (baseId: string): string => {
      if (isAdminUser) return baseId;
      if (
        baseId === DEFAULT_JUNIOR_DESIGN.id ||
        baseId === DEFAULT_SENIOR_DESIGN.id ||
        baseId === DEFAULT_BACK_CARD_DESIGN.id
      ) {
        return `${baseId}_${sanitizeId(uid, 'u').slice(0, 24)}`;
      }
      return baseId;
    };

    // 2. Seed / migrate Front Designs (including migrating legacy base64 custom bg images to Storage)
    if (this.knownFrontDesignIds.size === 0) {
      const localFronts = this.getFrontDesigns();
      for (const design of localFronts) {
        let nextDesign = { ...design, id: scopeDefaultDesignId(design.id) };
        if (
          nextDesign.bgType === 'custom' &&
          nextDesign.bgImageUrl.startsWith('data:image/') &&
          !nextDesign.bgImageUrl.startsWith('data:image/svg+xml')
        ) {
          const file = dataUrlToFile(nextDesign.bgImageUrl, `front_${nextDesign.id}`);
          if (file) {
            try {
              const uploaded = await this.uploadCardDesignImage(file, 'front', nextDesign.id);
              nextDesign.bgImageUrl = uploaded.url;
              nextDesign.bgImageStoragePath = uploaded.storagePath;
              nextDesign.bgImageAssetId = uploaded.assetId;
            } catch {
              // keep preset fallback if upload fails
            }
          }
        }
        await this.persistFrontDesignDoc(nextDesign, uid);
      }
    }

    // 3. Seed / migrate Back Designs
    if (this.knownBackDesignIds.size === 0) {
      const localBacks = this.getBackDesigns();
      for (const design of localBacks) {
        let nextDesign = { ...design, id: scopeDefaultDesignId(design.id) };
        if (
          nextDesign.bgImageUrl &&
          nextDesign.bgImageUrl.startsWith('data:image/') &&
          !nextDesign.bgImageUrl.startsWith('data:image/svg+xml')
        ) {
          const file = dataUrlToFile(nextDesign.bgImageUrl, `back_${nextDesign.id}`);
          if (file) {
            try {
              const uploaded = await this.uploadCardDesignImage(file, 'back', nextDesign.id);
              nextDesign.bgImageUrl = uploaded.url;
              nextDesign.bgImageStoragePath = uploaded.storagePath;
              nextDesign.bgImageAssetId = uploaded.assetId;
            } catch {
              // ignore
            }
          }
        }
        await this.persistBackDesignDoc(nextDesign, uid);
      }
    }

    // 4. Migrate local students / guardians / cards / history if Firestore is empty
    if (this.knownStudentIds.size === 0) {
      const localStudents = this.getStudents();
      for (const st of localStudents) {
        if (/^[0-9]{5}$/.test(st.studentId)) {
          await this.persistStudentDoc(st, uid);
        }
      }
    }

    if (this.knownGuardianIds.size === 0) {
      const localGuardians = this.getGuardians();
      for (const gd of localGuardians) {
        let nextGd = { ...gd };
        if (
          nextGd.photoUrl.startsWith('data:image/') &&
          !nextGd.photoUrl.startsWith('data:image/svg+xml')
        ) {
          const file = dataUrlToFile(nextGd.photoUrl, nextGd.photoFileName || nextGd.id);
          if (file) {
            try {
              const uploaded = await this.uploadGuardianPhoto(file, nextGd.photoFileName || file.name);
              nextGd.photoUrl = uploaded.photoUrl;
              nextGd.photoFileName = uploaded.photoFileName;
              nextGd.photoStoragePath = uploaded.photoStoragePath;
              nextGd.photoAssetId = uploaded.photoAssetId;
            } catch {
              // ignore
            }
          }
        }
        await this.persistGuardianDoc(nextGd, uid);
      }
    }

    if (this.knownCardIds.size === 0) {
      const localCards = this.getCards();
      for (const card of localCards) {
        if (this.knownStudentIds.has(card.studentId) && this.knownGuardianIds.has(card.guardianId)) {
          await this.persistCardDoc(card, uid);
        }
      }
    }

    if (this.knownHistoryIds.size === 0) {
      const localHistory = this.getPrintHistory();
      for (const item of localHistory) {
        await this.persistPrintHistoryDoc(item, uid);
      }
    }
  }

  // --- CLOUD SERIALIZERS & WRITERS (Strictly matching firebase-blueprint.json & firestore.rules) ---
  private sanitizeTrayConfig(tc: TrayCalibrationConfig): TrayCalibrationConfig {
    return {
      trayWidthMm: clampNum(tc.trayWidthMm, 50, 500, DEFAULT_TRAY_CONFIG.trayWidthMm),
      trayHeightMm: clampNum(tc.trayHeightMm, 50, 500, DEFAULT_TRAY_CONFIG.trayHeightMm),
      cardWidthMm: clampNum(tc.cardWidthMm, 20, 200, DEFAULT_TRAY_CONFIG.cardWidthMm),
      cardHeightMm: clampNum(tc.cardHeightMm, 20, 200, DEFAULT_TRAY_CONFIG.cardHeightMm),
      card1X: clampNum(tc.card1X, 0, 500, DEFAULT_TRAY_CONFIG.card1X),
      card1Y: clampNum(tc.card1Y, 0, 500, DEFAULT_TRAY_CONFIG.card1Y),
      card2X: clampNum(tc.card2X, 0, 500, DEFAULT_TRAY_CONFIG.card2X),
      card2Y: clampNum(tc.card2Y, 0, 500, DEFAULT_TRAY_CONFIG.card2Y),
      printerProfile: truncateStr(tc.printerProfile || DEFAULT_TRAY_CONFIG.printerProfile, 200),
      rotate180: Boolean(tc.rotate180),
    };
  }

  private async persistSystemSettingsToCloud(
    uid: string,
    vals: {
      academicYear: number;
      trayConfig: TrayCalibrationConfig;
      designerSamplePhotoUrl?: string;
      designerSamplePhotoPath?: string;
      designerSamplePhotoAssetId?: string;
    }
  ): Promise<void> {
    const settingId = this.getSettingsDocId(this.activeUser || auth.currentUser);
    const docRef = doc(db, 'system_settings', settingId);
    const path = `system_settings/${settingId}`;

    const rawSampleUrl = vals.designerSamplePhotoUrl || '';
    const isRasterDataUrl =
      rawSampleUrl.startsWith('data:image/') && !rawSampleUrl.startsWith('data:image/svg+xml');
    const sampleUrl = isRasterDataUrl ? '' : truncateStr(rawSampleUrl, 2048);
    const samplePath = isRasterDataUrl ? '' : truncateStr(vals.designerSamplePhotoPath || '', 512);
    const sampleAssetId = vals.designerSamplePhotoAssetId
      ? sanitizeId(vals.designerSamplePhotoAssetId, 'img')
      : '';

    const basePayload: Record<string, unknown> = {
      academicYear: Math.round(clampNum(vals.academicYear, 2500, 2700, 2569)),
      trayConfig: this.sanitizeTrayConfig(vals.trayConfig),
      designerSamplePhotoUrl: sampleUrl,
      designerSamplePhotoPath: samplePath,
      designerSamplePhotoAssetId: sampleAssetId,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownSystemSettings) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownSystemSettings = true;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async persistFrontDesignDoc(design: CardDesignConfig, uid: string): Promise<void> {
    const docId = sanitizeId(design.id, 'design_front');
    const docRef = doc(db, 'front_designs', docId);
    const path = `front_designs/${docId}`;

    const bgAssetId = design.bgImageAssetId ? sanitizeId(design.bgImageAssetId, 'img') : '';

    const basePayload: Record<string, unknown> = {
      id: docId,
      name: truncateStr(design.name || design.title || 'แม่แบบหน้าบัตร', 200),
      isDefault: Boolean(design.isDefault),
      level: design.level === 'มัธยมศึกษาตอนปลาย' ? 'มัธยมศึกษาตอนปลาย' : 'มัธยมศึกษาตอนต้น',
      title: truncateStr(design.title || '', 200),
      subtitle: truncateStr(design.subtitle || '', 200),
      bgImageUrl: truncateStr(design.bgImageUrl || '', 10000),
      bgImageStoragePath: truncateStr(design.bgImageStoragePath || '', 512),
      bgImageAssetId: bgAssetId,
      bgType: design.bgType === 'custom' ? 'custom' : 'preset',
      bgLayerAbovePhoto: design.bgLayerAbovePhoto !== false,
      elements: design.elements,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownFrontDesignIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownFrontDesignIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteFrontDesignDoc(designId: string): Promise<void> {
    const docId = sanitizeId(designId, 'design_front');
    const path = `front_designs/${docId}`;
    try {
      await deleteDoc(doc(db, 'front_designs', docId));
      this.knownFrontDesignIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistBackDesignDoc(design: BackCardDesignConfig, uid: string): Promise<void> {
    const docId = sanitizeId(design.id, 'design_back');
    const docRef = doc(db, 'back_designs', docId);
    const path = `back_designs/${docId}`;

    const rules = (Array.isArray(design.rules) ? design.rules : [])
      .slice(0, 12)
      .map((r) => truncateStr(String(r ?? ''), 300));
    const bgAssetId = design.bgImageAssetId ? sanitizeId(design.bgImageAssetId, 'img') : '';

    const basePayload: Record<string, unknown> = {
      id: docId,
      name: truncateStr(design.name || design.title || 'แม่แบบหลังบัตร', 200),
      isDefault: Boolean(design.isDefault),
      displayMode: design.displayMode === 'imageOnly' ? 'imageOnly' : 'template',
      title: truncateStr(design.title || '', 200),
      subtitle: truncateStr(design.subtitle || '', 200),
      rules,
      emergencyLabel: truncateStr(design.emergencyLabel || '', 200),
      emergencyPhone: truncateStr(design.emergencyPhone || '', 100),
      footerNote: truncateStr(design.footerNote || '', 300),
      accentColor: truncateStr(design.accentColor || '#1e3a8a', 30),
      textColor: truncateStr(design.textColor || '#1e293b', 30),
      bgColor: truncateStr(design.bgColor || '#ffffff', 30),
      bgImageUrl: truncateStr(design.bgImageUrl || '', 2048),
      bgImageStoragePath: truncateStr(design.bgImageStoragePath || '', 512),
      bgImageAssetId: bgAssetId,
      showLogo: Boolean(design.showLogo),
      showSignatureBox: Boolean(design.showSignatureBox),
      signatureLabel: truncateStr(design.signatureLabel || '', 150),
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownBackDesignIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownBackDesignIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteBackDesignDoc(designId: string): Promise<void> {
    const docId = sanitizeId(designId, 'design_back');
    const path = `back_designs/${docId}`;
    try {
      await deleteDoc(doc(db, 'back_designs', docId));
      this.knownBackDesignIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistStudentDoc(student: Student, uid: string): Promise<void> {
    if (!/^[0-9]{5}$/.test(student.studentId)) return;
    const docId = student.studentId;
    const docRef = doc(db, 'students', docId);
    const path = `students/${docId}`;

    const basePayload: Record<string, unknown> = {
      studentId: docId,
      prefix: truncateStr(student.prefix || '', 50),
      firstName: truncateStr(student.firstName || '-', 120) || '-',
      lastName: truncateStr(student.lastName || '-', 120) || '-',
      nickname: truncateStr(student.nickname || '', 80),
      level: student.level === 'มัธยมศึกษาตอนปลาย' ? 'มัธยมศึกษาตอนปลาย' : 'มัธยมศึกษาตอนต้น',
      classroom: truncateStr(student.classroom || '1', 30) || '1',
      entryYear: Math.round(clampNum(student.entryYear, 2500, 2700, 2569)),
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownStudentIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownStudentIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteStudentDoc(studentId: string): Promise<void> {
    if (!/^[0-9]{5}$/.test(studentId)) return;
    const path = `students/${studentId}`;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      this.knownStudentIds.delete(studentId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistGuardianDoc(guardian: Guardian, uid: string): Promise<void> {
    const docId = sanitizeId(guardian.id, 'guard');
    const docRef = doc(db, 'guardians', docId);
    const path = `guardians/${docId}`;

    const photoAssetId = guardian.photoAssetId ? sanitizeId(guardian.photoAssetId, 'img') : '';

    const basePayload: Record<string, unknown> = {
      id: docId,
      prefix: truncateStr(guardian.prefix || '', 50),
      firstName: truncateStr(guardian.firstName || '-', 120) || '-',
      lastName: truncateStr(guardian.lastName || '-', 120) || '-',
      relation: truncateStr(guardian.relation || 'ผู้ปกครอง', 80) || 'ผู้ปกครอง',
      phone: truncateStr(guardian.phone || '', 40),
      photoUrl: truncateStr(guardian.photoUrl || '', 2048),
      photoFileName: truncateStr(guardian.photoFileName || 'guardian_photo.jpg', 256),
      photoStoragePath: truncateStr(guardian.photoStoragePath || '', 512),
      photoAssetId,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownGuardianIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownGuardianIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteGuardianDoc(guardianId: string): Promise<void> {
    const docId = sanitizeId(guardianId, 'guard');
    const path = `guardians/${docId}`;
    try {
      await deleteDoc(doc(db, 'guardians', docId));
      this.knownGuardianIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistCardDoc(card: PickupCard, uid: string): Promise<void> {
    const docId = sanitizeId(card.id, 'card');
    const docRef = doc(db, 'cards', docId);
    const path = `cards/${docId}`;

    const basePayload: Record<string, unknown> = {
      id: docId,
      studentId: card.studentId,
      guardianId: sanitizeId(card.guardianId, 'guard'),
      issueDate: truncateStr(card.issueDate || '', 20),
      expiryDate: truncateStr(card.expiryDate || '', 20),
      status: card.status === 'expired' || card.status === 'revoked' ? card.status : 'active',
      qrCodeText: truncateStr(card.qrCodeText || `CARD:${card.studentId}`, 300),
      printCount: Math.round(clampNum(card.printCount, 0, 100000, 0)),
      lastPrintedAt: card.lastPrintedAt ? truncateStr(card.lastPrintedAt, 60) : null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownCardIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownCardIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteCardDoc(cardId: string): Promise<void> {
    const docId = sanitizeId(cardId, 'card');
    const path = `cards/${docId}`;
    try {
      await deleteDoc(doc(db, 'cards', docId));
      this.knownCardIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistPrintHistoryDoc(item: PrintHistoryItem, uid: string): Promise<void> {
    const docId = sanitizeId(item.id, 'hist');
    if (this.knownHistoryIds.has(docId)) return; // Immutable audit log
    const docRef = doc(db, 'print_history', docId);
    const path = `print_history/${docId}`;

    const payload: Record<string, unknown> = {
      id: docId,
      ownerId: uid,
      timestamp: truncateStr(item.timestamp || new Date().toISOString(), 60),
      thaiDateString: truncateStr(item.thaiDateString || '-', 100),
      studentId: truncateStr(item.studentId || '-', 20),
      studentName: truncateStr(item.studentName || '-', 200),
      guardianName: truncateStr(item.guardianName || '-', 200),
      level: item.level === 'มัธยมศึกษาตอนปลาย' ? 'มัธยมศึกษาตอนปลาย' : 'มัธยมศึกษาตอนต้น',
      classroom: truncateStr(item.classroom || '-', 40),
      slotNumber: item.slotNumber === 2 ? 2 : 1,
      printType: item.printType === 'พิมพ์ซ้ำ (Reprint)' ? 'พิมพ์ซ้ำ (Reprint)' : 'บัตรใหม่',
      printSide: item.printSide === 'หลังบัตร' ? 'หลังบัตร' : 'หน้าบัตร',
      operatorName: truncateStr(item.operatorName || 'เจ้าหน้าที่', 150),
      cardId: sanitizeId(item.cardId || 'back_card_template', 'card'),
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, payload);
      this.knownHistoryIds.add(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  private async deletePrintHistoryDoc(historyId: string): Promise<void> {
    const docId = sanitizeId(historyId, 'hist');
    const path = `print_history/${docId}`;
    try {
      await deleteDoc(doc(db, 'print_history', docId));
      this.knownHistoryIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private async persistOperatorAccountDoc(account: OperatorAccount, uid: string): Promise<void> {
    const docId = sanitizeId(account.id || account.uid, 'op');
    const docRef = doc(db, 'operator_accounts', docId);
    const path = `operator_accounts/${docId}`;

    const cleanUsername = (account.username || 'user')
      .trim()
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .slice(0, 64) || 'user';

    const basePayload: Record<string, unknown> = {
      id: docId,
      uid: sanitizeId(account.uid || docId, 'op'),
      username: cleanUsername,
      email: truncateStr(account.email || `${cleanUsername}@pcccr.ac.th`, 200),
      fullName: truncateStr(account.fullName || cleanUsername, 150) || cleanUsername,
      position: truncateStr(account.position || 'เจ้าหน้าที่ระบบ', 150),
      role: 'admin',
      isActive: account.isActive !== false,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownOperatorIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownOperatorIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async deleteOperatorAccountDoc(accountId: string): Promise<void> {
    const docId = sanitizeId(accountId, 'op');
    const path = `operator_accounts/${docId}`;
    try {
      await deleteDoc(doc(db, 'operator_accounts', docId));
      this.knownOperatorIds.delete(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  // --- FIRESTORE IMAGE ASSETS & FIREBASE STORAGE HYBRID UPLOADS ---
  private normalizeImageContentType(ct: string): ImageAsset['contentType'] {
    if (ct === 'image/jpeg' || ct === 'image/png' || ct === 'image/svg+xml') return ct;
    return 'image/webp';
  }

  private async persistImageAssetDoc(asset: ImageAsset, uid: string): Promise<void> {
    const docId = sanitizeId(asset.id, 'img');
    const docRef = doc(db, 'image_assets', docId);
    const path = `image_assets/${docId}`;

    const safeDataUrl =
      asset.dataUrl && asset.dataUrl.startsWith('data:image/') && asset.dataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS
        ? asset.dataUrl
        : '';
    const safeStorageUrl = truncateStr(asset.storageUrl || '', 2048);

    const basePayload: Record<string, unknown> = {
      id: docId,
      category: asset.category,
      fileName: truncateStr(asset.fileName || 'image.webp', 256) || 'image.webp',
      contentType: this.normalizeImageContentType(asset.contentType),
      width: Math.round(clampNum(asset.width, 1, 4096, 400)),
      height: Math.round(clampNum(asset.height, 1, 4096, 400)),
      originalSize: Math.round(clampNum(asset.originalSize, 0, 52428800, 0)),
      compressedSize: Math.round(clampNum(asset.compressedSize, 0, 1048576, 0)),
      storageBackend: asset.storageBackend,
      storageUrl: safeStorageUrl,
      storagePath: truncateStr(asset.storagePath || '', 512),
      dataUrl: safeDataUrl,
      updatedAt: serverTimestamp(),
    };

    try {
      if (this.knownImageAssetIds.has(docId)) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          ...basePayload,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
        this.knownImageAssetIds.add(docId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public getImageAssets(category?: ImageAssetCategory): ImageAsset[] {
    let list = this.cloudImageAssets;
    if (list.length === 0) {
      const saved = this.getItem(STORAGE_KEYS.IMAGE_ASSETS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            list = parsed;
            this.cloudImageAssets = parsed;
          }
        } catch {
          // ignore
        }
      }
    }
    return category ? list.filter((a) => a.category === category) : list;
  }

  public getImageAssetById(assetId?: string): ImageAsset | undefined {
    if (!assetId) return undefined;
    return this.getImageAssets().find((a) => a.id === assetId);
  }

  public resolveImageSrc(urlOrRef?: string, assetId?: string): string {
    const raw = (urlOrRef || '').trim();
    const extractedId = raw.startsWith('firestore-asset://')
      ? raw.slice('firestore-asset://'.length)
      : assetId;

    if (extractedId) {
      const asset = this.getImageAssetById(extractedId);
      if (asset) {
        if (raw.startsWith('firestore-asset://') || !raw) {
          return asset.dataUrl || asset.storageUrl || '';
        }
        return raw;
      }
      if (raw.startsWith('firestore-asset://')) {
        return '';
      }
    }
    return raw;
  }

  public getImageFallbackDataUrl(urlOrRef?: string, assetId?: string): string | undefined {
    const raw = (urlOrRef || '').trim();
    const extractedId = raw.startsWith('firestore-asset://')
      ? raw.slice('firestore-asset://'.length)
      : assetId;
    const assets = this.getImageAssets();
    const matched =
      (extractedId ? assets.find((a) => a.id === extractedId) : undefined) ||
      (raw ? assets.find((a) => a.storageUrl === raw) : undefined);
    return matched?.dataUrl || undefined;
  }

  public getImageAssetReferences(asset: ImageAsset): ImageAssetReference[] {
    const refs: ImageAssetReference[] = [];
    const assetRefUri = `firestore-asset://${asset.id}`;
    const guardians = this.getGuardians();
    const cards = this.getCards();

    for (const g of guardians) {
      const matched =
        g.photoAssetId === asset.id ||
        g.photoUrl === assetRefUri ||
        Boolean(asset.storageUrl && g.photoUrl === asset.storageUrl) ||
        Boolean(asset.storagePath && g.photoStoragePath === asset.storagePath) ||
        Boolean(asset.dataUrl && g.photoUrl === asset.dataUrl) ||
        (!g.photoAssetId &&
          !g.photoStoragePath &&
          Boolean(asset.fileName && g.photoFileName === asset.fileName));

      if (matched) {
        const linkedCardsCount = cards.filter((c) => c.guardianId === g.id).length;
        const guardianFullName = `${g.prefix}${g.firstName} ${g.lastName}`.trim();
        refs.push({
          type: 'guardian',
          id: g.id,
          label: `ผู้ปกครอง: ${guardianFullName}`,
          detail:
            linkedCardsCount > 0
              ? `${g.relation} • ผูกบัตรรับส่งอยู่ ${linkedCardsCount} ใบ`
              : `${g.relation} • มีข้อมูลผู้ปกครองในระบบ`,
        });
      }
    }

    for (const fd of this.getFrontDesigns()) {
      const matched =
        fd.bgImageAssetId === asset.id ||
        fd.bgImageUrl === assetRefUri ||
        Boolean(asset.storageUrl && fd.bgImageUrl === asset.storageUrl) ||
        Boolean(asset.storagePath && fd.bgImageStoragePath === asset.storagePath);
      if (matched) {
        refs.push({
          type: 'front_design',
          id: fd.id,
          label: `แม่แบบหน้าบัตร: ${fd.name || fd.title || fd.id}`,
          detail: fd.level,
        });
      }
    }

    for (const bd of this.getBackDesigns()) {
      const matched =
        bd.bgImageAssetId === asset.id ||
        bd.bgImageUrl === assetRefUri ||
        Boolean(asset.storageUrl && bd.bgImageUrl === asset.storageUrl) ||
        Boolean(asset.storagePath && bd.bgImageStoragePath === asset.storagePath);
      if (matched) {
        refs.push({
          type: 'back_design',
          id: bd.id,
          label: `แม่แบบหลังบัตร: ${bd.name || bd.title || bd.id}`,
          detail: bd.displayMode === 'imageOnly' ? 'ภาพพื้นหลังเต็มใบ' : 'รูปแบบมาตรฐาน',
        });
      }
    }

    const sampleUrl = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO) || '';
    const samplePath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '';
    const sampleAssetId = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '';
    const sampleMatched =
      sampleAssetId === asset.id ||
      sampleUrl === assetRefUri ||
      Boolean(asset.storageUrl && sampleUrl === asset.storageUrl) ||
      Boolean(asset.storagePath && samplePath === asset.storagePath);
    if (sampleMatched) {
      refs.push({
        type: 'sample_photo',
        id: 'designer_sample_photo',
        label: 'รูปตัวอย่างในหน้าออกแบบบัตร (Card Designer)',
        detail: 'กำลังตั้งค่าเป็นภาพตัวอย่างระบบ',
      });
    }

    return refs;
  }

  public getFirestoreUsageSummary(): FirestoreUsageSummary {
    const FIRESTORE_FREE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GiB (Spark Free Tier)
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const measureBytes = (value: unknown): number => {
      try {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        if (!str) return 0;
        return encoder ? encoder.encode(str).length : str.length * 2;
      } catch {
        return 0;
      }
    };

    const measureDocs = (docs: unknown[], perDocOverhead = 64): number => {
      let total = 0;
      for (const item of docs) {
        total += measureBytes(item) + perDocOverhead;
      }
      return total;
    };

    const imageAssets = this.getImageAssets();
    let imageAssetsBytes = 0;
    for (const asset of imageAssets) {
      const jsonBytes = measureBytes(asset) + 64;
      // Ensure assets stored with binary size only still reflect realistic storage footprint if dataUrl absent
      const effectiveBytes =
        asset.dataUrl && asset.dataUrl.length > 0
          ? jsonBytes
          : jsonBytes + (asset.compressedSize || 0);
      imageAssetsBytes += effectiveBytes;
    }

    const students = this.getStudents();
    const guardians = this.getGuardians();
    const cards = this.getCards();
    const frontDesigns = this.getFrontDesigns();
    const backDesigns = this.getBackDesigns();
    const printHistory = this.getPrintHistory();
    const operators = this.getOperatorAccounts();

    const studentsBytes = measureDocs(students);
    const guardiansBytes = measureDocs(guardians);
    const cardsBytes = measureDocs(cards);
    const frontDesignsBytes = measureDocs(frontDesigns);
    const backDesignsBytes = measureDocs(backDesigns);
    const printHistoryBytes = measureDocs(printHistory);
    const operatorsBytes = measureDocs(operators);

    const settingsPayload = {
      academicYear: this.getAcademicYear(),
      trayConfig: this.getTrayConfig(),
      designerSamplePhotoUrl: this.getDesignerSamplePhotoRaw(),
      designerSamplePhotoPath: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '',
      designerSamplePhotoAssetId: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '',
    };
    const settingsBytes = measureBytes(settingsPayload) + 64;

    const breakdown: FirestoreUsageBreakdownItem[] = [
      {
        key: 'image_assets',
        label: 'รูปภาพในคลัง (image_assets)',
        count: imageAssets.length,
        bytes: imageAssetsBytes,
      },
      {
        key: 'students',
        label: 'ข้อมูลนักเรียน',
        count: students.length,
        bytes: studentsBytes,
      },
      {
        key: 'guardians',
        label: 'ข้อมูลผู้ปกครอง',
        count: guardians.length,
        bytes: guardiansBytes,
      },
      {
        key: 'cards',
        label: 'บัตรรับส่งนักเรียน',
        count: cards.length,
        bytes: cardsBytes,
      },
      {
        key: 'designs',
        label: 'แม่แบบหน้า-หลังบัตร',
        count: frontDesigns.length + backDesigns.length,
        bytes: frontDesignsBytes + backDesignsBytes,
      },
      {
        key: 'history_and_settings',
        label: 'ประวัติพิมพ์และตั้งค่าระบบ',
        count: printHistory.length + operators.length + 1,
        bytes: printHistoryBytes + operatorsBytes + settingsBytes,
      },
    ];

    const totalUsedBytes = breakdown.reduce((sum, item) => sum + item.bytes, 0);
    const otherDataBytes = Math.max(0, totalUsedBytes - imageAssetsBytes);
    const remainingBytes = Math.max(0, FIRESTORE_FREE_QUOTA_BYTES - totalUsedBytes);
    const usedPercentage = Math.min(100, (totalUsedBytes / FIRESTORE_FREE_QUOTA_BYTES) * 100);
    const totalDocuments =
      imageAssets.length +
      students.length +
      guardians.length +
      cards.length +
      frontDesigns.length +
      backDesigns.length +
      printHistory.length +
      operators.length +
      1;

    return {
      quotaBytes: FIRESTORE_FREE_QUOTA_BYTES,
      totalUsedBytes,
      remainingBytes,
      usedPercentage,
      imageAssetsBytes,
      otherDataBytes,
      totalDocuments,
      breakdown,
    };
  }

  public async deleteImageAsset(assetId: string): Promise<void> {
    const docId = sanitizeId(assetId, 'img');
    const existing = this.getImageAssetById(docId);
    if (existing?.storagePath) {
      await this.deleteStorageObjectQuietly(existing.storagePath);
    }
    const path = `image_assets/${docId}`;
    try {
      await deleteDoc(doc(db, 'image_assets', docId));
      this.knownImageAssetIds.delete(docId);
      this.cloudImageAssets = this.cloudImageAssets.filter((a) => a.id !== docId);
      this.setItem(STORAGE_KEYS.IMAGE_ASSETS, JSON.stringify(this.cloudImageAssets));
      this.notifyListeners();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  private isFatalStorageError(err: unknown): boolean {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    return (
      code === 'storage/unauthorized' ||
      code === 'storage/unauthenticated' ||
      code === 'storage/bucket-not-found' ||
      code === 'storage/project-not-found' ||
      code === 'storage/retry-limit-exceeded' ||
      code === 'storage/unknown' ||
      msg.includes('timeout') ||
      msg.includes('CORS')
    );
  }

  private async syncImageAssetToStorageInBackground(params: {
    assetId: string;
    storagePath: string;
    blob: Blob;
    contentType: string;
    customMetadata?: Record<string, string>;
  }): Promise<void> {
    if (this.storageAvailability === 'unavailable') return;
    const { assetId, storagePath, blob, contentType, customMetadata } = params;
    try {
      const storageRef = ref(storage, storagePath);
      await this.withTimeout(
        uploadBytes(storageRef, blob, { contentType, customMetadata }),
        5500,
        'Firebase Storage upload timeout'
      );
      const storageUrl = await this.withTimeout(
        getDownloadURL(storageRef),
        3500,
        'Firebase Storage URL timeout'
      );
      this.storageAvailability = 'available';

      const docId = sanitizeId(assetId, 'img');
      const safeStorageUrl = truncateStr(storageUrl, 2048);
      const safeStoragePath = truncateStr(storagePath, 512);
      await updateDoc(doc(db, 'image_assets', docId), {
        storageBackend: 'both',
        storageUrl: safeStorageUrl,
        storagePath: safeStoragePath,
        updatedAt: serverTimestamp(),
      });

      this.cloudImageAssets = this.cloudImageAssets.map((a) =>
        a.id === docId
          ? {
              ...a,
              storageBackend: 'both',
              storageUrl: safeStorageUrl,
              storagePath: safeStoragePath,
              updatedAt: new Date().toISOString(),
            }
          : a
      );
      this.setItem(STORAGE_KEYS.IMAGE_ASSETS, JSON.stringify(this.cloudImageAssets));
      this.notifyListeners();
    } catch (storageErr) {
      if (this.isFatalStorageError(storageErr)) {
        this.storageAvailability = 'unavailable';
      }
      console.warn('Background Firebase Storage sync skipped (using Firestore image_assets):', storageErr);
    }
  }

  private async uploadAndRegisterImageAsset(params: {
    compressed: CompressedImageResult;
    category: ImageAssetCategory;
    fileName: string;
    storagePath: string;
    customMetadata?: Record<string, string>;
  }): Promise<UploadedImageSummary> {
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพไปยัง Firebase');
    }

    const { compressed, category, fileName, storagePath, customMetadata } = params;
    const assetId = sanitizeId(`img_${category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, 'img');

    const hasFirestoreData =
      compressed.dataUrl.startsWith('data:image/') &&
      compressed.dataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS;

    let storageUrl = '';
    let finalStoragePath = '';

    // Fast path: when compressed dataUrl fits inside Firestore (normal case), register immediately
    // in Firestore without blocking on Firebase Storage, then sync Storage in the background.
    if (!hasFirestoreData) {
      if (this.storageAvailability === 'unavailable') {
        throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกินขีดจำกัด กรุณาเลือกไฟล์ขนาดเล็กลง');
      }
      try {
        const storageRef = ref(storage, storagePath);
        await this.withTimeout(
          uploadBytes(storageRef, compressed.blob, {
            contentType: compressed.contentType,
            customMetadata,
          }),
          10000,
          'Firebase Storage upload timeout'
        );
        storageUrl = await this.withTimeout(
          getDownloadURL(storageRef),
          5000,
          'Firebase Storage URL timeout'
        );
        finalStoragePath = storagePath;
        this.storageAvailability = 'available';
      } catch (storageErr) {
        if (this.isFatalStorageError(storageErr)) {
          this.storageAvailability = 'unavailable';
        }
        throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกินขีดจำกัด กรุณาเลือกไฟล์ขนาดเล็กลง');
      }
    }

    const storageBackend: ImageAsset['storageBackend'] =
      storageUrl && hasFirestoreData ? 'both' : storageUrl ? 'storage' : 'firestore';

    const now = new Date().toISOString();
    const assetRecord: ImageAsset = {
      id: assetId,
      ownerId: uid,
      category,
      fileName: truncateStr(fileName, 256) || `image.${compressed.extension}`,
      contentType: this.normalizeImageContentType(compressed.contentType),
      width: compressed.width,
      height: compressed.height,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      storageBackend,
      storageUrl,
      storagePath: finalStoragePath,
      dataUrl: hasFirestoreData ? compressed.dataUrl : '',
      createdAt: now,
      updatedAt: now,
    };

    // Update local memory/cache immediately so previews render with zero delay
    this.cloudImageAssets = [assetRecord, ...this.cloudImageAssets.filter((a) => a.id !== assetId)];
    this.setItem(STORAGE_KEYS.IMAGE_ASSETS, JSON.stringify(this.cloudImageAssets));
    this.notifyListeners();

    await this.persistImageAssetDoc(assetRecord, uid);

    if (hasFirestoreData && this.storageAvailability !== 'unavailable') {
      void this.syncImageAssetToStorageInBackground({
        assetId,
        storagePath,
        blob: compressed.blob,
        contentType: compressed.contentType,
        customMetadata,
      });
    }

    const resolvedRefUrl = storageUrl || `firestore-asset://${assetId}`;
    return {
      url: resolvedRefUrl,
      storagePath: finalStoragePath,
      assetId,
      storageBackend,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      contentType: compressed.contentType,
      width: compressed.width,
      height: compressed.height,
      dataUrl: compressed.dataUrl,
    };
  }

  public async uploadCardDesignImage(
    file: File,
    side: 'front' | 'back',
    designId: string
  ): Promise<UploadedImageSummary> {
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพไปยัง Firebase');
    }

    const compressed = await compressCardImage(file);
    const cleanDesignId = sanitizeId(designId, `design_${side}`);
    const storagePath = `card_designs/${uid}/${side}/${cleanDesignId}_${Date.now()}.${compressed.extension}`;
    const fileName = sanitizeFileName(file.name || `${side}_${cleanDesignId}.${compressed.extension}`);

    return this.uploadAndRegisterImageAsset({
      compressed,
      category: side === 'front' ? 'front_bg' : 'back_bg',
      fileName,
      storagePath,
      customMetadata: {
        originalSize: String(compressed.originalSize),
        compressedSize: String(compressed.compressedSize),
        side,
        designId: cleanDesignId,
      },
    });
  }

  public async uploadSamplePhoto(file: File): Promise<UploadedImageSummary> {
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปตัวอย่างไปยัง Firebase');
    }

    const compressed = await compressAvatarPhoto(file);
    const oldPath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
    const storagePath = `system_settings/${uid}/sample_photo_${Date.now()}.${compressed.extension}`;
    const fileName = sanitizeFileName(file.name || `sample_photo.${compressed.extension}`);

    const summary = await this.uploadAndRegisterImageAsset({
      compressed,
      category: 'sample_photo',
      fileName,
      storagePath,
    });

    this.saveDesignerSamplePhoto(summary.url, summary.storagePath, summary.assetId);

    if (oldPath && oldPath !== summary.storagePath) {
      void this.deleteStorageObjectQuietly(oldPath);
    }

    return summary;
  }

  public async uploadGuardianPhoto(
    file: File,
    originalFileName: string
  ): Promise<{
    photoUrl: string;
    photoFileName: string;
    photoStoragePath: string;
    photoAssetId: string;
    storageBackend: 'both' | 'storage' | 'firestore';
    originalSize: number;
    compressedSize: number;
  }> {
    const compressed = await compressAvatarPhoto(file);
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปถ่ายผู้ปกครองไปยัง Firebase');
    }

    const baseName = sanitizeFileName(originalFileName).replace(/\.[^.]+$/, '');
    const photoFileName = `${baseName}.${compressed.extension}`;
    const storagePath = `guardians/${uid}/${Date.now()}_${photoFileName}`;

    const summary = await this.uploadAndRegisterImageAsset({
      compressed,
      category: 'guardian_photo',
      fileName: photoFileName,
      storagePath,
      customMetadata: {
        originalFileName: sanitizeFileName(originalFileName),
        originalSize: String(compressed.originalSize),
        compressedSize: String(compressed.compressedSize),
      },
    });

    return {
      photoUrl: summary.url,
      photoFileName,
      photoStoragePath: summary.storagePath,
      photoAssetId: summary.assetId,
      storageBackend: summary.storageBackend,
      originalSize: summary.originalSize,
      compressedSize: summary.compressedSize,
    };
  }

  private async deleteStorageObjectQuietly(storagePath?: string): Promise<void> {
    if (!storagePath || this.storageAvailability === 'unavailable') return;
    try {
      await this.withTimeout(
        deleteObject(ref(storage, storagePath)),
        4000,
        'Storage delete timeout'
      );
    } catch (e) {
      console.warn('Storage file cleanup skipped or failed:', e);
    }
  }

  private isDesignImagePathReferenced(storagePath?: string, excludeDesignId?: string): boolean {
    if (!storagePath) return false;
    const fronts = this.getFrontDesigns();
    const backs = this.getBackDesigns();
    return (
      fronts.some((d) => d.id !== excludeDesignId && d.bgImageStoragePath === storagePath) ||
      backs.some((d) => d.id !== excludeDesignId && d.bgImageStoragePath === storagePath)
    );
  }

  // --- ACADEMIC YEAR ---
  public getAcademicYear(): number {
    const saved = this.getItem(STORAGE_KEYS.ACADEMIC_YEAR);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 2569;
  }

  public setAcademicYear(year: number): void {
    this.setItem(STORAGE_KEYS.ACADEMIC_YEAR, year.toString());
    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(() =>
        this.persistSystemSettingsToCloud(uid, {
          academicYear: year,
          trayConfig: this.getTrayConfig(),
          designerSamplePhotoUrl: this.getDesignerSamplePhotoRaw(),
          designerSamplePhotoPath: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '',
          designerSamplePhotoAssetId: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '',
        })
      );
    }
  }

  // --- DESIGNER SAMPLE GUARDIAN PHOTO ---
  public getDesignerSamplePhotoRaw(): string {
    return this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO) || '';
  }

  public getDesignerSamplePhoto(): string {
    const raw = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO) || '';
    const assetId = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '';
    return this.resolveImageSrc(raw, assetId);
  }

  public saveDesignerSamplePhoto(url: string | null, storagePath?: string, assetId?: string): void {
    const prevPath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '';
    if (url) {
      this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO, url);
      if (storagePath !== undefined) {
        if (storagePath) {
          this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH, storagePath);
        } else {
          this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
        }
      }
      if (assetId !== undefined) {
        if (assetId) {
          this.setItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID, assetId);
        } else {
          this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID);
        }
      }
    } else {
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO);
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
      this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID);
      if (prevPath) {
        void this.deleteStorageObjectQuietly(prevPath);
      }
    }

    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(() =>
        this.persistSystemSettingsToCloud(uid, {
          academicYear: this.getAcademicYear(),
          trayConfig: this.getTrayConfig(),
          designerSamplePhotoUrl: url || '',
          designerSamplePhotoPath: url ? (storagePath ?? this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) ?? '') : '',
          designerSamplePhotoAssetId: url ? (assetId ?? this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) ?? '') : '',
        })
      );
    }
  }

  // --- TRAY CONFIGURATION ---
  public getTrayConfig(): TrayCalibrationConfig {
    const saved = this.getItem(STORAGE_KEYS.TRAY_CONFIG);
    if (saved) {
      try {
        return {
          ...DEFAULT_TRAY_CONFIG,
          ...JSON.parse(saved),
        };
      } catch (e) {
        console.error(e);
      }
    }
    this.setItem(STORAGE_KEYS.TRAY_CONFIG, JSON.stringify(DEFAULT_TRAY_CONFIG));
    return DEFAULT_TRAY_CONFIG;
  }

  public saveTrayConfig(config: TrayCalibrationConfig): void {
    const clean = this.sanitizeTrayConfig(config);
    this.setItem(STORAGE_KEYS.TRAY_CONFIG, JSON.stringify(clean));
    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(() =>
        this.persistSystemSettingsToCloud(uid, {
          academicYear: this.getAcademicYear(),
          trayConfig: clean,
          designerSamplePhotoUrl: this.getDesignerSamplePhotoRaw(),
          designerSamplePhotoPath: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '',
          designerSamplePhotoAssetId: this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '',
        })
      );
    }
  }

  // --- STUDENTS ---
  public getStudents(): Student[] {
    const saved = this.getItem(STORAGE_KEYS.STUDENTS);
    if (saved) {
      try {
        const loaded: Student[] = JSON.parse(saved);
        if (Array.isArray(loaded)) return loaded;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  public saveStudents(students: Student[]): void {
    const prevIds = new Set(this.getStudents().map((s) => s.studentId));
    this.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(students.map((s) => s.studentId));
      this.enqueueWrite(async () => {
        for (const st of students) {
          await this.persistStudentDoc(st, uid);
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await this.deleteStudentDoc(oldId);
          }
        }
      });
    }
  }

  // --- GUARDIANS ---
  public getGuardians(): Guardian[] {
    const saved = this.getItem(STORAGE_KEYS.GUARDIANS);
    if (saved) {
      try {
        const loaded: Guardian[] = JSON.parse(saved);
        if (Array.isArray(loaded)) return loaded;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  public saveGuardians(guardians: Guardian[]): void {
    const prevList = this.getGuardians();
    this.setItem(STORAGE_KEYS.GUARDIANS, JSON.stringify(guardians));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(guardians.map((g) => g.id));
      this.enqueueWrite(async () => {
        for (const gd of guardians) {
          await this.persistGuardianDoc(gd, uid);
        }
        for (const old of prevList) {
          if (!nextIds.has(old.id)) {
            await this.deleteGuardianDoc(old.id);
          }
        }
      });
    }
  }

  // --- CARDS ---
  public getCards(): PickupCard[] {
    const saved = this.getItem(STORAGE_KEYS.CARDS);
    if (saved) {
      try {
        const loaded: PickupCard[] = JSON.parse(saved);
        if (Array.isArray(loaded)) return loaded;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  public saveCards(cards: PickupCard[]): void {
    const prevIds = new Set(this.getCards().map((c) => c.id));
    this.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(cards.map((c) => c.id));
      this.enqueueWrite(async () => {
        for (const card of cards) {
          await this.persistCardDoc(card, uid);
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await this.deleteCardDoc(oldId);
          }
        }
      });
    }
  }

  // --- FRONT CARD DESIGNS ---
  private normalizeFrontDesign(design: CardDesignConfig): CardDesignConfig {
    const defaultVal =
      design.level === 'มัธยมศึกษาตอนต้น' ? DEFAULT_JUNIOR_DESIGN : DEFAULT_SENIOR_DESIGN;
    const normalized: CardDesignConfig = {
      ...defaultVal,
      ...design,
      name: design.name || design.title || defaultVal.name,
      bgLayerAbovePhoto: design.bgLayerAbovePhoto === undefined ? true : design.bgLayerAbovePhoto,
      elements: {
        ...defaultVal.elements,
        ...(design.elements || {}),
      },
    };
    if (normalized.bgType === 'preset') {
      normalized.bgImageUrl = defaultVal.bgImageUrl;
    }
    return normalized;
  }

  public getFrontDesigns(): CardDesignConfig[] {
    const saved = this.getItem(STORAGE_KEYS.FRONT_DESIGNS);
    if (saved) {
      try {
        const parsed: CardDesignConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d) => this.normalizeFrontDesign(d));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { ...DEFAULT_JUNIOR_DESIGN, isDefault: true },
      { ...DEFAULT_SENIOR_DESIGN, isDefault: true },
    ];
  }

  public saveFrontDesigns(designs: CardDesignConfig[]): void {
    const prevIds = new Set(this.getFrontDesigns().map((d) => d.id));
    this.setItem(STORAGE_KEYS.FRONT_DESIGNS, JSON.stringify(designs));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(designs.map((d) => d.id));
      this.enqueueWrite(async () => {
        for (const d of designs) {
          await this.persistFrontDesignDoc(d, uid);
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await this.deleteFrontDesignDoc(oldId);
          }
        }
      });
    }
  }

  public getFrontDesignById(id?: string): CardDesignConfig | undefined {
    if (!id) return undefined;
    return this.getFrontDesigns().find((d) => d.id === id);
  }

  public saveFrontDesign(design: CardDesignConfig): CardDesignConfig[] {
    const list = this.getFrontDesigns();
    const prev = list.find((d) => d.id === design.id);
    const now = new Date().toISOString();
    const toSave: CardDesignConfig = {
      ...this.normalizeFrontDesign(design),
      updatedAt: now,
    };

    // Clean up replaced Firebase Storage background image if no other design uses it
    if (
      prev?.bgImageStoragePath &&
      prev.bgImageStoragePath !== toSave.bgImageStoragePath &&
      !this.isDesignImagePathReferenced(prev.bgImageStoragePath, prev.id)
    ) {
      void this.deleteStorageObjectQuietly(prev.bgImageStoragePath);
    }

    const exists = list.some((d) => d.id === toSave.id);
    let updated: CardDesignConfig[];

    if (exists) {
      updated = list.map((d) => {
        if (d.id === toSave.id) return toSave;
        if (toSave.isDefault && d.level === toSave.level) {
          return { ...d, isDefault: false };
        }
        return d;
      });
    } else {
      const base = toSave.isDefault
        ? list.map((d) => (d.level === toSave.level ? { ...d, isDefault: false } : d))
        : list;
      updated = [...base, toSave];
    }

    this.setItem(STORAGE_KEYS.FRONT_DESIGNS, JSON.stringify(updated));

    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(async () => {
        await this.persistFrontDesignDoc(toSave, uid);
        if (toSave.isDefault) {
          for (const d of updated) {
            if (d.id !== toSave.id && d.level === toSave.level) {
              await this.persistFrontDesignDoc(d, uid);
            }
          }
        }
      });
    }

    return updated;
  }

  public setDefaultFrontDesign(id: string): CardDesignConfig[] {
    const list = this.getFrontDesigns();
    const target = list.find((d) => d.id === id);
    if (!target) return list;

    const updated = list.map((d) =>
      d.level === target.level ? { ...d, isDefault: d.id === id } : d
    );
    this.saveFrontDesigns(updated);
    return updated;
  }

  public deleteFrontDesign(id: string): CardDesignConfig[] {
    const list = this.getFrontDesigns();
    if (list.length <= 1) return list;

    const target = list.find((d) => d.id === id);
    let remaining = list.filter((d) => d.id !== id);

    if (target?.isDefault) {
      const hasAnotherSameLevel = remaining.some((d) => d.level === target.level);
      if (hasAnotherSameLevel) {
        let promoted = false;
        remaining = remaining.map((d) => {
          if (!promoted && d.level === target.level) {
            promoted = true;
            return { ...d, isDefault: true };
          }
          return d;
        });
      }
    }

    if (
      target?.bgImageStoragePath &&
      !this.isDesignImagePathReferenced(target.bgImageStoragePath, target.id)
    ) {
      void this.deleteStorageObjectQuietly(target.bgImageStoragePath);
    }

    this.setItem(STORAGE_KEYS.FRONT_DESIGNS, JSON.stringify(remaining));
    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(async () => {
        await this.deleteFrontDesignDoc(id);
        for (const d of remaining) {
          if (target?.isDefault && d.isDefault && d.level === target.level) {
            await this.persistFrontDesignDoc(d, uid);
          }
        }
      });
    }
    return remaining;
  }

  public getCardDesign(level: EducationLevel): CardDesignConfig {
    const all = this.getFrontDesigns();
    const defaultForLevel = all.find((d) => d.level === level && d.isDefault);
    if (defaultForLevel) return defaultForLevel;
    const anyForLevel = all.find((d) => d.level === level);
    if (anyForLevel) return anyForLevel;
    return level === 'มัธยมศึกษาตอนต้น' ? DEFAULT_JUNIOR_DESIGN : DEFAULT_SENIOR_DESIGN;
  }

  public saveCardDesign(design: CardDesignConfig): void {
    this.saveFrontDesign(design);
  }

  // --- BACK CARD DESIGNS ---
  private normalizeBackDesign(design: BackCardDesignConfig): BackCardDesignConfig {
    return {
      ...DEFAULT_BACK_CARD_DESIGN,
      ...design,
      name: design.name || design.title || DEFAULT_BACK_CARD_DESIGN.name,
    };
  }

  public getBackDesigns(): BackCardDesignConfig[] {
    const saved = this.getItem(STORAGE_KEYS.BACK_DESIGNS);
    if (saved) {
      try {
        const parsed: BackCardDesignConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d) => this.normalizeBackDesign(d));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [{ ...DEFAULT_BACK_CARD_DESIGN, isDefault: true }];
  }

  public saveBackDesigns(designs: BackCardDesignConfig[]): void {
    const prevIds = new Set(this.getBackDesigns().map((d) => d.id));
    this.setItem(STORAGE_KEYS.BACK_DESIGNS, JSON.stringify(designs));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(designs.map((d) => d.id));
      this.enqueueWrite(async () => {
        for (const d of designs) {
          await this.persistBackDesignDoc(d, uid);
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await this.deleteBackDesignDoc(oldId);
          }
        }
      });
    }
  }

  public getBackDesignById(id?: string): BackCardDesignConfig | undefined {
    if (!id) return undefined;
    return this.getBackDesigns().find((d) => d.id === id);
  }

  public saveBackDesign(design: BackCardDesignConfig): BackCardDesignConfig[] {
    const list = this.getBackDesigns();
    const prev = list.find((d) => d.id === design.id);
    const now = new Date().toISOString();
    const toSave: BackCardDesignConfig = {
      ...this.normalizeBackDesign(design),
      updatedAt: now,
    };

    if (
      prev?.bgImageStoragePath &&
      prev.bgImageStoragePath !== toSave.bgImageStoragePath &&
      !this.isDesignImagePathReferenced(prev.bgImageStoragePath, prev.id)
    ) {
      void this.deleteStorageObjectQuietly(prev.bgImageStoragePath);
    }

    const exists = list.some((d) => d.id === toSave.id);
    let updated: BackCardDesignConfig[];

    if (exists) {
      updated = list.map((d) => {
        if (d.id === toSave.id) return toSave;
        if (toSave.isDefault) return { ...d, isDefault: false };
        return d;
      });
    } else {
      const base = toSave.isDefault ? list.map((d) => ({ ...d, isDefault: false })) : list;
      updated = [...base, toSave];
    }

    this.setItem(STORAGE_KEYS.BACK_DESIGNS, JSON.stringify(updated));

    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(async () => {
        await this.persistBackDesignDoc(toSave, uid);
        if (toSave.isDefault) {
          for (const d of updated) {
            if (d.id !== toSave.id) {
              await this.persistBackDesignDoc(d, uid);
            }
          }
        }
      });
    }

    return updated;
  }

  public setDefaultBackDesign(id: string): BackCardDesignConfig[] {
    const list = this.getBackDesigns();
    const target = list.find((d) => d.id === id);
    if (!target) return list;

    const updated = list.map((d) => ({ ...d, isDefault: d.id === id }));
    this.saveBackDesigns(updated);
    return updated;
  }

  public deleteBackDesign(id: string): BackCardDesignConfig[] {
    const list = this.getBackDesigns();
    if (list.length <= 1) return list;

    const target = list.find((d) => d.id === id);
    let remaining = list.filter((d) => d.id !== id);
    if (target?.isDefault && remaining.length > 0) {
      remaining = remaining.map((d, idx) => (idx === 0 ? { ...d, isDefault: true } : d));
    }

    if (
      target?.bgImageStoragePath &&
      !this.isDesignImagePathReferenced(target.bgImageStoragePath, target.id)
    ) {
      void this.deleteStorageObjectQuietly(target.bgImageStoragePath);
    }

    this.setItem(STORAGE_KEYS.BACK_DESIGNS, JSON.stringify(remaining));
    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(async () => {
        await this.deleteBackDesignDoc(id);
        if (target?.isDefault && remaining[0]) {
          await this.persistBackDesignDoc(remaining[0], uid);
        }
      });
    }
    return remaining;
  }

  public getBackCardDesign(): BackCardDesignConfig {
    const all = this.getBackDesigns();
    return all.find((d) => d.isDefault) || all[0] || DEFAULT_BACK_CARD_DESIGN;
  }

  public saveBackCardDesign(design: BackCardDesignConfig): void {
    this.saveBackDesign(design);
  }

  // --- PRINT PREVIEW PAYLOAD (Cross-Tab) ---
  public savePrintPreviewPayload(payload: PrintPreviewPayload): void {
    this.setItem(STORAGE_KEYS.PRINT_PREVIEW_PAYLOAD, JSON.stringify(payload));
  }

  public getPrintPreviewPayload(): PrintPreviewPayload | null {
    const saved = this.getItem(STORAGE_KEYS.PRINT_PREVIEW_PAYLOAD);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  }

  // --- USERS, PASSWORDS & FIREBASE AUTO-PERMISSION ---
  public getUsers(): UserAccount[] {
    return INITIAL_USERS;
  }

  public getRememberedUsername(): string {
    return this.getItem(STORAGE_KEYS.REMEMBERED_USERNAME) || '';
  }

  public setRememberedUsername(username: string): void {
    const clean = username.trim();
    if (clean) {
      this.setItem(STORAGE_KEYS.REMEMBERED_USERNAME, clean);
    } else {
      this.removeItem(STORAGE_KEYS.REMEMBERED_USERNAME);
    }
  }

  private upsertInMemoryOperator(account: OperatorAccount): void {
    const idx = this.cloudOperatorAccounts.findIndex((op) => op.id === account.id);
    if (idx >= 0) {
      this.cloudOperatorAccounts = this.cloudOperatorAccounts.map((op, i) =>
        i === idx ? account : op
      );
    } else {
      this.cloudOperatorAccounts = [...this.cloudOperatorAccounts, account].sort((a, b) =>
        a.username.localeCompare(b.username)
      );
    }
    const activeFbUid = auth.currentUser?.uid || this.activeUser?.uid;
    if (activeFbUid && (account.uid === activeFbUid || account.id === activeFbUid)) {
      this.currentOperatorProfile = account;
    }
  }

  private async ensureDefaultSystemAdminInFirestore(fbUser: User): Promise<OperatorAccount> {
    if (this.currentOperatorProfile) {
      return this.currentOperatorProfile;
    }
    if (this.adminSeedPromise) {
      await this.adminSeedPromise;
      if (this.currentOperatorProfile) return this.currentOperatorProfile;
    }

    let resultRecord: OperatorAccount | null = null;
    this.adminSeedPromise = (async () => {
      const docRef = doc(db, 'operator_accounts', fbUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        this.knownOperatorIds.add(snap.id);
        const raw = snap.data() as Record<string, unknown>;
        resultRecord = {
          ...(raw as unknown as OperatorAccount),
          id: snap.id,
          createdAt: tsToIso(raw.createdAt),
          updatedAt: tsToIso(raw.updatedAt),
        };
        this.upsertInMemoryOperator(resultRecord);
        return;
      }

      const now = new Date().toISOString();
      resultRecord = {
        id: fbUser.uid,
        ownerId: fbUser.uid,
        uid: fbUser.uid,
        username: SYSTEM_ADMIN_RECOVERY.username,
        email: SYSTEM_ADMIN_RECOVERY.email,
        fullName: SYSTEM_ADMIN_RECOVERY.fullName,
        position: SYSTEM_ADMIN_RECOVERY.position,
        role: 'admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await this.persistOperatorAccountDoc(resultRecord, fbUser.uid);
      this.upsertInMemoryOperator(resultRecord);
    })();

    try {
      await this.adminSeedPromise;
    } finally {
      this.adminSeedPromise = null;
    }

    return (
      resultRecord || {
        id: fbUser.uid,
        ownerId: fbUser.uid,
        uid: fbUser.uid,
        username: SYSTEM_ADMIN_RECOVERY.username,
        email: SYSTEM_ADMIN_RECOVERY.email,
        fullName: SYSTEM_ADMIN_RECOVERY.fullName,
        position: SYSTEM_ADMIN_RECOVERY.position,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  public getSystemAdminRecoveryProfile(): UserAccount & { email: string } {
    return SYSTEM_ADMIN_RECOVERY;
  }

  public getOperatorAccounts(): OperatorAccount[] {
    const merged = [...this.cloudOperatorAccounts];
    if (
      this.currentOperatorProfile &&
      !merged.some((op) => op.id === this.currentOperatorProfile!.id)
    ) {
      merged.push(this.currentOperatorProfile);
    }
    merged.sort((a, b) => a.username.localeCompare(b.username));
    return merged;
  }

  public resolveLoginEmail(userOrEmail: string): string {
    const trimmed = userOrEmail.trim();
    if (!trimmed) return '';
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    const lowerUser = trimmed.toLowerCase();
    if (lowerUser === SYSTEM_ADMIN_RECOVERY.username.toLowerCase()) {
      return SYSTEM_ADMIN_RECOVERY.email.toLowerCase();
    }
    const matched = this.getOperatorAccounts().find(
      (op) => op.username.toLowerCase() === lowerUser
    );
    if (matched?.email) {
      return matched.email.toLowerCase();
    }
    const cleanLocal = lowerUser.replace(/[^a-z0-9_.-]/g, '') || 'admin';
    return `${cleanLocal}@pcccr.ac.th`;
  }

  public buildUserAccountFromFirebaseUser(fbUser: User): UserAccount {
    const isPasswordUser = fbUser.providerData.some((p) => p.providerId === 'password');
    const emailLower = (fbUser.email || '').toLowerCase();
    const matchedOp =
      (this.currentOperatorProfile?.uid === fbUser.uid ? this.currentOperatorProfile : undefined) ||
      this.getOperatorAccounts().find(
        (op) => op.uid === fbUser.uid || op.email.toLowerCase() === emailLower
      );
    const isDefaultAdminEmail = emailLower === SYSTEM_ADMIN_RECOVERY.email.toLowerCase();
    const defaultName =
      matchedOp?.fullName ||
      (isDefaultAdminEmail ? SYSTEM_ADMIN_RECOVERY.fullName : '') ||
      fbUser.displayName ||
      fbUser.email ||
      'ผู้ดูแลระบบ';

    const defaultPosition =
      matchedOp?.position ||
      (this.isUserBootstrappedAdmin(fbUser)
        ? 'ผู้ดูแลระบบหลัก (Admin)'
        : isDefaultAdminEmail
        ? SYSTEM_ADMIN_RECOVERY.position
        : isPasswordUser
        ? 'เจ้าหน้าที่ระบบ'
        : 'ผู้ใช้งานระบบ');

    return {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || undefined,
      authMethod: isPasswordUser ? 'password' : 'google',
      username:
        matchedOp?.username ||
        (isDefaultAdminEmail ? SYSTEM_ADMIN_RECOVERY.username : fbUser.email || fbUser.uid),
      fullName: defaultName,
      role: 'admin',
      position: defaultPosition,
      createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
      isActive: matchedOp ? matchedOp.isActive !== false : true,
    };
  }

  public async loginWithGoogle(): Promise<UserAccount> {
    await this.ready();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const fbUser = cred.user;

    await this.initRealtimeSync(fbUser);
    const account = this.buildUserAccountFromFirebaseUser(fbUser);
    this.setCurrentUser(account);
    return account;
  }

  public async loginWithUsernameAndPassword(
    userOrEmail: string,
    password: string
  ): Promise<UserAccount> {
    await this.ready();
    const trimmedInput = userOrEmail.trim();
    if (!trimmedInput || !password) {
      throw new Error('กรุณากรอกชื่อผู้ใช้ (หรืออีเมล) และรหัสผ่าน');
    }

    const resolvedEmail = this.resolveLoginEmail(trimmedInput);
    const isDefaultAdminMatch =
      (trimmedInput.toLowerCase() === SYSTEM_ADMIN_RECOVERY.username.toLowerCase() ||
        resolvedEmail === SYSTEM_ADMIN_RECOVERY.email.toLowerCase()) &&
      password === (SYSTEM_ADMIN_RECOVERY.password || '213894120');

    let fbUser: User | null = null;

    try {
      const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password);
      fbUser = cred.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      // Auto-provision default admin account in Firebase Auth on first login using system recovery file
      if (
        isDefaultAdminMatch &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
      ) {
        const created = await createUserWithEmailAndPassword(auth, resolvedEmail, password);
        await updateProfile(created.user, {
          displayName: SYSTEM_ADMIN_RECOVERY.fullName,
        });
        fbUser = created.user;
      } else {
        throw err;
      }
    }

    await this.initRealtimeSync(fbUser);

    // Verify directly against Firestore operator_accounts/{uid} (works even when ownerId != uid)
    const selfDocRef = doc(db, 'operator_accounts', fbUser.uid);
    const selfSnap = await getDoc(selfDocRef);
    let existingOp: OperatorAccount | undefined;

    if (selfSnap.exists()) {
      this.knownOperatorIds.add(selfSnap.id);
      const raw = selfSnap.data() as Record<string, unknown>;
      existingOp = {
        ...(raw as unknown as OperatorAccount),
        id: selfSnap.id,
        createdAt: tsToIso(raw.createdAt),
        updatedAt: tsToIso(raw.updatedAt),
      };
      this.upsertInMemoryOperator(existingOp);

      if (existingOp.isActive === false) {
        await fbSignOut(auth);
        this.stopRealtimeSync();
        this.setCurrentUser(null);
        throw new Error('บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      }
    } else if (resolvedEmail === SYSTEM_ADMIN_RECOVERY.email.toLowerCase()) {
      existingOp = await this.ensureDefaultSystemAdminInFirestore(fbUser);
    } else {
      const derivedUsername = trimmedInput.includes('@')
        ? resolvedEmail.split('@')[0]
        : trimmedInput;
      const now = new Date().toISOString();
      const opRecord: OperatorAccount = {
        id: fbUser.uid,
        ownerId: fbUser.uid,
        uid: fbUser.uid,
        username: derivedUsername.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'user',
        email: resolvedEmail,
        fullName: fbUser.displayName || derivedUsername,
        position: 'เจ้าหน้าที่ระบบ',
        role: 'admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await this.persistOperatorAccountDoc(opRecord, fbUser.uid);
      this.upsertInMemoryOperator(opRecord);
    }

    const account = this.buildUserAccountFromFirebaseUser(fbUser);
    this.setCurrentUser(account);
    this.notifyListeners();
    return account;
  }

  public async createOperatorAccount(params: {
    username: string;
    email?: string;
    password: string;
    fullName: string;
    position: string;
    grantAdmin?: boolean;
  }): Promise<OperatorAccount> {
    const currentUid = this.getCurrentUid();
    if (!currentUid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนสร้างบัญชีผู้ใช้งาน');
    }

    const cleanUsername = params.username.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (!cleanUsername) {
      throw new Error('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ . -');
    }
    if (params.password.length < 6) {
      throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร (ข้อกำหนดของ Firebase Auth)');
    }

    const email = (params.email?.trim() || `${cleanUsername.toLowerCase()}@pcccr.ac.th`).toLowerCase();

    // Provision Firebase Auth user using a secondary app instance so current admin stays logged in
    const appName = `OperatorProvisioner_${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    let newUid = '';

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, params.password);
      await updateProfile(cred.user, {
        displayName: params.fullName.trim() || cleanUsername,
      });
      newUid = cred.user.uid;
      await fbSignOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }

    const now = new Date().toISOString();
    const record: OperatorAccount = {
      id: newUid,
      ownerId: currentUid,
      uid: newUid,
      username: cleanUsername,
      email,
      fullName: params.fullName.trim() || cleanUsername,
      position: params.position.trim() || 'เจ้าหน้าที่ระบบ',
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.persistOperatorAccountDoc(record, currentUid);
    this.upsertInMemoryOperator(record);

    if (params.grantAdmin && this.isUserBootstrappedAdmin(auth.currentUser)) {
      const adminPath = `admins/${newUid}`;
      try {
        await setDoc(doc(db, 'admins', newUid), {
          email,
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, adminPath);
      }
    }

    this.notifyListeners();
    return record;
  }

  public async updateOperatorAccount(
    accountId: string,
    updates: { fullName: string; position: string; isActive?: boolean }
  ): Promise<OperatorAccount> {
    const currentUid = this.getCurrentUid();
    if (!currentUid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนแก้ไขบัญชีผู้ใช้งาน');
    }

    const docId = sanitizeId(accountId, 'op');
    const existing = this.getOperatorAccounts().find((op) => op.id === docId);
    if (!existing) {
      throw new Error('ไม่พบข้อมูลบัญชีผู้ใช้งานใน Firebase');
    }

    const cleanFullName =
      truncateStr(updates.fullName.trim() || existing.username, 150) || existing.username;
    const cleanPosition = truncateStr(updates.position.trim() || 'เจ้าหน้าที่ระบบ', 150);
    const nextIsActive =
      updates.isActive !== undefined ? Boolean(updates.isActive) : existing.isActive !== false;

    const docRef = doc(db, 'operator_accounts', docId);
    const path = `operator_accounts/${docId}`;

    try {
      await updateDoc(docRef, {
        fullName: cleanFullName,
        position: cleanPosition,
        isActive: nextIsActive,
        updatedAt: serverTimestamp(),
      });
      this.knownOperatorIds.add(docId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    const updatedRecord: OperatorAccount = {
      ...existing,
      fullName: cleanFullName,
      position: cleanPosition,
      isActive: nextIsActive,
      updatedAt: new Date().toISOString(),
    };

    this.upsertInMemoryOperator(updatedRecord);

    const fbUser = auth.currentUser;
    if (fbUser && (fbUser.uid === updatedRecord.uid || fbUser.uid === docId)) {
      try {
        await updateProfile(fbUser, { displayName: cleanFullName });
      } catch {
        // ignore displayName update failure
      }
      this.setCurrentUser(this.buildUserAccountFromFirebaseUser(fbUser));
    }

    this.notifyListeners();
    return updatedRecord;
  }

  public async restoreSystemAdminToFirebase(): Promise<OperatorAccount> {
    const fbUser = auth.currentUser;
    const currentUid = this.getCurrentUid();
    if (!fbUser || !currentUid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนกู้คืนบัญชีผู้ดูแลระบบลง Firebase');
    }

    const adminEmailLower = SYSTEM_ADMIN_RECOVERY.email.toLowerCase();
    const currentEmailLower = (fbUser.email || '').toLowerCase();

    let existingAdmin = this.getOperatorAccounts().find(
      (op) =>
        op.username.toLowerCase() === SYSTEM_ADMIN_RECOVERY.username.toLowerCase() ||
        op.email.toLowerCase() === adminEmailLower
    );

    if (!existingAdmin && currentEmailLower === adminEmailLower) {
      const selfSnap = await getDoc(doc(db, 'operator_accounts', fbUser.uid));
      if (selfSnap.exists()) {
        const raw = selfSnap.data() as Record<string, unknown>;
        existingAdmin = {
          ...(raw as unknown as OperatorAccount),
          id: selfSnap.id,
          createdAt: tsToIso(raw.createdAt),
          updatedAt: tsToIso(raw.updatedAt),
        };
        this.knownOperatorIds.add(selfSnap.id);
      }
    }

    if (!existingAdmin && this.isUserBootstrappedAdmin(fbUser)) {
      const recoveryPath = `operator_accounts/${SYSTEM_ADMIN_RECOVERY.id}`;
      try {
        const recoverySnap = await getDoc(doc(db, 'operator_accounts', SYSTEM_ADMIN_RECOVERY.id));
        if (recoverySnap.exists()) {
          const raw = recoverySnap.data() as Record<string, unknown>;
          existingAdmin = {
            ...(raw as unknown as OperatorAccount),
            id: recoverySnap.id,
            createdAt: tsToIso(raw.createdAt),
            updatedAt: tsToIso(raw.updatedAt),
          };
          this.knownOperatorIds.add(recoverySnap.id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, recoveryPath);
      }
    }

    if (!existingAdmin && currentEmailLower !== adminEmailLower && !this.isUserBootstrappedAdmin(fbUser)) {
      throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (admin) เพื่อกู้คืนข้อมูลผู้ดูแลระบบ');
    }

    const targetDocId =
      existingAdmin?.id ||
      (currentEmailLower === adminEmailLower ? fbUser.uid : SYSTEM_ADMIN_RECOVERY.id);
    const targetUid =
      existingAdmin?.uid ||
      (currentEmailLower === adminEmailLower ? fbUser.uid : SYSTEM_ADMIN_RECOVERY.id);
    const docRef = doc(db, 'operator_accounts', targetDocId);
    const path = `operator_accounts/${targetDocId}`;
    const nowIso = new Date().toISOString();

    let restoredRecord: OperatorAccount;
    try {
      if (existingAdmin) {
        await updateDoc(docRef, {
          fullName: SYSTEM_ADMIN_RECOVERY.fullName,
          position: SYSTEM_ADMIN_RECOVERY.position,
          isActive: true,
          updatedAt: serverTimestamp(),
        });
        this.knownOperatorIds.add(targetDocId);
        restoredRecord = {
          ...existingAdmin,
          fullName: SYSTEM_ADMIN_RECOVERY.fullName,
          position: SYSTEM_ADMIN_RECOVERY.position,
          isActive: true,
          updatedAt: nowIso,
        };
      } else {
        restoredRecord = {
          id: targetDocId,
          ownerId: currentUid,
          uid: targetUid,
          username: SYSTEM_ADMIN_RECOVERY.username,
          email: SYSTEM_ADMIN_RECOVERY.email,
          fullName: SYSTEM_ADMIN_RECOVERY.fullName,
          position: SYSTEM_ADMIN_RECOVERY.position,
          role: 'admin',
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await setDoc(docRef, {
          id: targetDocId,
          ownerId: currentUid,
          uid: targetUid,
          username: SYSTEM_ADMIN_RECOVERY.username,
          email: SYSTEM_ADMIN_RECOVERY.email,
          fullName: SYSTEM_ADMIN_RECOVERY.fullName,
          position: SYSTEM_ADMIN_RECOVERY.position,
          role: 'admin',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        this.knownOperatorIds.add(targetDocId);
      }
    } catch (error) {
      handleFirestoreError(
        error,
        existingAdmin ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
      throw error;
    }

    this.upsertInMemoryOperator(restoredRecord);

    if (currentEmailLower === adminEmailLower || fbUser.uid === restoredRecord.uid) {
      try {
        await updateProfile(fbUser, { displayName: SYSTEM_ADMIN_RECOVERY.fullName });
      } catch {
        // ignore
      }
      this.setCurrentUser(this.buildUserAccountFromFirebaseUser(fbUser));
    }

    this.notifyListeners();
    return restoredRecord;
  }

  public async deleteOperatorAccountRecord(accountId: string): Promise<void> {
    await this.deleteOperatorAccountDoc(accountId);
    this.cloudOperatorAccounts = this.cloudOperatorAccounts.filter((a) => a.id !== accountId);
    if (this.currentOperatorProfile?.id === accountId) {
      this.currentOperatorProfile = null;
    }
    this.notifyListeners();
  }

  public async changeCurrentPassword(newPassword: string): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error('ไม่พบผู้ใช้งานที่เข้าสู่ระบบ');
    }
    if (newPassword.length < 6) {
      throw new Error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    }
    await updatePassword(fbUser, newPassword);
  }

  public async verifyFirebasePermissions(): Promise<{
    authOk: boolean;
    firestoreOk: boolean;
    storageOk: boolean;
    authMethod: string;
    firestoreError?: string;
    storageError?: string;
  }> {
    const fbUser = auth.currentUser;
    const authOk = this.isAuthorizedFirebaseUser(fbUser);
    const isPassword = Boolean(fbUser?.providerData.some((p) => p.providerId === 'password'));
    const authMethod = !fbUser
      ? 'ยังไม่ได้เข้าสู่ระบบ'
      : isPassword
      ? 'User & Password (Firebase Auth)'
      : 'Google Account (Verified)';

    if (!authOk || !fbUser) {
      return {
        authOk: false,
        firestoreOk: false,
        storageOk: false,
        authMethod,
        firestoreError: 'ยังไม่ได้ยืนยันตัวตนกับ Firebase Authentication',
        storageError: 'ยังไม่ได้ยืนยันตัวตนกับ Firebase Authentication',
      };
    }

    let firestoreOk = false;
    let firestoreError: string | undefined;
    try {
      await this.syncAllDataToFirebase();
      const settingId = this.getSettingsDocId(fbUser);
      await getDoc(doc(db, 'system_settings', settingId));
      firestoreOk = true;
    } catch (e) {
      firestoreError = e instanceof Error ? e.message : 'ไม่สามารถเชื่อมต่อ Firestore ได้';
    }

    let storageOk = false;
    let storageError: string | undefined;
    try {
      const checkPath = `system_settings/${fbUser.uid}/_permission_check_${Date.now()}.txt`;
      const checkRef = ref(storage, checkPath);
      const blob = new Blob(['ok'], { type: 'text/plain' });
      await this.withTimeout(
        uploadBytes(checkRef, blob, { contentType: 'text/plain' }),
        5000,
        'Firebase Storage connection timeout'
      );
      await this.withTimeout(getDownloadURL(checkRef), 3500, 'Firebase Storage URL timeout');
      await this.withTimeout(deleteObject(checkRef), 3500, 'Firebase Storage delete timeout');
      storageOk = true;
      this.storageAvailability = 'available';
    } catch (e) {
      this.storageAvailability = 'unavailable';
      storageError =
        e instanceof Error
          ? e.message
          : 'ยังไม่ได้ตั้งค่า Firebase Storage Rules สำหรับบัญชีนี้';
    }

    return {
      authOk,
      firestoreOk,
      storageOk,
      authMethod,
      firestoreError,
      storageError,
    };
  }

  public getCurrentUser(): UserAccount | null {
    const fbUser = auth.currentUser;
    if (this.isAuthorizedFirebaseUser(fbUser) && fbUser) {
      return this.buildUserAccountFromFirebaseUser(fbUser);
    }

    const saved = this.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return null;
  }

  public setCurrentUser(user: UserAccount | null): void {
    if (user) {
      this.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      this.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // --- PRINT HISTORY ---
  public getPrintHistory(): PrintHistoryItem[] {
    const saved = this.getItem(STORAGE_KEYS.PRINT_HISTORY);
    if (saved) {
      try {
        const loaded: PrintHistoryItem[] = JSON.parse(saved);
        if (Array.isArray(loaded)) return loaded;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  public savePrintHistory(history: PrintHistoryItem[]): void {
    const prevIds = new Set(this.getPrintHistory().map((h) => h.id));
    this.setItem(STORAGE_KEYS.PRINT_HISTORY, JSON.stringify(history));

    const uid = this.getCurrentUid();
    if (uid) {
      const nextIds = new Set(history.map((h) => h.id));
      this.enqueueWrite(async () => {
        for (const item of history) {
          if (!this.knownHistoryIds.has(item.id)) {
            await this.persistPrintHistoryDoc(item, uid);
          }
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await this.deletePrintHistoryDoc(oldId);
          }
        }
      });
    }
  }

  public addPrintHistoryItem(item: PrintHistoryItem): void {
    const history = this.getPrintHistory();
    history.unshift(item);
    this.setItem(STORAGE_KEYS.PRINT_HISTORY, JSON.stringify(history));

    const uid = this.getCurrentUid();
    if (uid) {
      this.enqueueWrite(() => this.persistPrintHistoryDoc(item, uid));
    }
  }

  // --- SMART IMAGE ORPHAN CLEANUP ---
  public isImageReferencedByOtherGuardians(
    photoFileName: string,
    excludeGuardianId?: string,
    photoStoragePath?: string
  ): boolean {
    if (!photoFileName && !photoStoragePath) return false;
    const allGuardians = this.getGuardians();
    return allGuardians.some((g) => {
      if (g.id === excludeGuardianId) return false;
      if (photoStoragePath && g.photoStoragePath) {
        return g.photoStoragePath === photoStoragePath;
      }
      return Boolean(photoFileName && g.photoFileName === photoFileName);
    });
  }

  public async deletePhotoIfOrphaned(
    photoFileName: string,
    excludeGuardianId?: string,
    photoStoragePath?: string
  ): Promise<{ deleted: boolean; reason: string }> {
    if (!photoFileName && !photoStoragePath) {
      return { deleted: false, reason: 'ไม่มีชื่อไฟล์รูปภาพ' };
    }

    const hasOtherRef = this.isImageReferencedByOtherGuardians(
      photoFileName,
      excludeGuardianId,
      photoStoragePath
    );
    if (hasOtherRef) {
      return {
        deleted: false,
        reason: `รูปภาพ "${photoFileName}" ยังถูกอ้างอิงโดยผู้ปกครองคนอื่นในระบบ จึงไม่ลบออกจากพื้นที่เก็บข้อมูล`,
      };
    }

    if (photoStoragePath) {
      await this.deleteStorageObjectQuietly(photoStoragePath);
    } else if (photoFileName) {
      await this.deleteStorageObjectQuietly(`guardians/${photoFileName}`);
    }

    return {
      deleted: true,
      reason: `ลบไฟล์รูปภาพ "${photoFileName || photoStoragePath}" ออกจาก Firebase Storage เรียบร้อยแล้ว`,
    };
  }

  public async deleteGuardian(
    guardianId: string
  ): Promise<{ success: boolean; imageStatus: string }> {
    const guardians = this.getGuardians();
    const target = guardians.find((g) => g.id === guardianId);
    if (!target) return { success: false, imageStatus: 'ไม่พบผู้ปกครอง' };

    const checkResult = await this.deletePhotoIfOrphaned(
      target.photoFileName,
      guardianId,
      target.photoStoragePath
    );

    const cards = this.getCards();
    const remainingCards = cards.filter((c) => c.guardianId !== guardianId);
    this.saveCards(remainingCards);

    const remainingGuardians = guardians.filter((g) => g.id !== guardianId);
    this.saveGuardians(remainingGuardians);

    return { success: true, imageStatus: checkResult.reason };
  }

  public async deleteStudent(
    studentId: string
  ): Promise<{ success: boolean; removedCardsCount: number }> {
    const students = this.getStudents();
    const remainingStudents = students.filter((s) => s.studentId !== studentId);
    this.saveStudents(remainingStudents);

    const cards = this.getCards();
    const cardsToRemove = cards.filter((c) => c.studentId === studentId);
    const remainingCards = cards.filter((c) => c.studentId !== studentId);
    this.saveCards(remainingCards);

    return { success: true, removedCardsCount: cardsToRemove.length };
  }

  public async cleanupSelectedGraduatedStudents(
    studentIds: string[]
  ): Promise<{
    studentsCount: number;
    cardsCount: number;
    orphanedPhotosDeleted: number;
    cleanedStudentIds: string[];
  }> {
    const graduatingIds = new Set(studentIds);
    if (graduatingIds.size === 0) {
      return {
        studentsCount: 0,
        cardsCount: 0,
        orphanedPhotosDeleted: 0,
        cleanedStudentIds: [],
      };
    }

    const allStudents = this.getStudents();
    const graduatingStudents = allStudents.filter((s) => graduatingIds.has(s.studentId));
    if (graduatingStudents.length === 0) {
      return {
        studentsCount: 0,
        cardsCount: 0,
        orphanedPhotosDeleted: 0,
        cleanedStudentIds: [],
      };
    }

    const remainingStudents = allStudents.filter((s) => !graduatingIds.has(s.studentId));
    this.saveStudents(remainingStudents);

    const allCards = this.getCards();
    const affectedCards = allCards.filter((c) => graduatingIds.has(c.studentId));
    const remainingCards = allCards.filter((c) => !graduatingIds.has(c.studentId));
    this.saveCards(remainingCards);

    const allGuardians = this.getGuardians();
    let orphanedPhotosDeleted = 0;

    for (const guardian of allGuardians) {
      const stillHasCards = remainingCards.some((c) => c.guardianId === guardian.id);
      if (!stillHasCards && (guardian.photoStoragePath || guardian.photoFileName)) {
        const result = await this.deletePhotoIfOrphaned(
          guardian.photoFileName,
          undefined,
          guardian.photoStoragePath
        );
        if (result.deleted) {
          orphanedPhotosDeleted++;
        }
      }
    }

    return {
      studentsCount: graduatingStudents.length,
      cardsCount: affectedCards.length,
      orphanedPhotosDeleted,
      cleanedStudentIds: graduatingStudents.map((s) => s.studentId),
    };
  }

  public async cleanupGraduatedStudents(
    targetLevel: EducationLevel,
    graduatingEntryYear: number
  ): Promise<{
    studentsCount: number;
    cardsCount: number;
    orphanedPhotosDeleted: number;
    cleanedStudentIds: string[];
  }> {
    const allStudents = this.getStudents();
    const graduatingIds = allStudents
      .filter((s) => s.level === targetLevel && s.entryYear <= graduatingEntryYear)
      .map((s) => s.studentId);

    return this.cleanupSelectedGraduatedStudents(graduatingIds);
  }

  /**
   * Force-sync all current local configurations, designs, data & images to Firestore
   */
  public async syncAllDataToFirebase(): Promise<void> {
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนซิงค์ข้อมูลขึ้น Firebase');
    }

    let sampleUrl = this.getDesignerSamplePhotoRaw();
    let samplePath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH) || '';
    let sampleAssetId = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID) || '';
    if (sampleUrl && sampleUrl.startsWith('data:image/') && !sampleUrl.startsWith('data:image/svg+xml')) {
      const file = dataUrlToFile(sampleUrl, 'sample_guardian');
      if (file) {
        const uploaded = await this.uploadSamplePhoto(file);
        sampleUrl = uploaded.url;
        samplePath = uploaded.storagePath;
        sampleAssetId = uploaded.assetId;
      }
    }

    await this.persistSystemSettingsToCloud(uid, {
      academicYear: this.getAcademicYear(),
      trayConfig: this.getTrayConfig(),
      designerSamplePhotoUrl: sampleUrl,
      designerSamplePhotoPath: samplePath,
      designerSamplePhotoAssetId: sampleAssetId,
    });

    const frontDesigns = this.getFrontDesigns();
    let frontChanged = false;
    const nextFronts = [];
    for (const d of frontDesigns) {
      let nextD = d;
      if (d.bgType === 'custom' && d.bgImageUrl.startsWith('data:image/') && !d.bgImageUrl.startsWith('data:image/svg+xml')) {
        const file = dataUrlToFile(d.bgImageUrl, `front_${d.id}`);
        if (file) {
          const uploaded = await this.uploadCardDesignImage(file, 'front', d.id);
          nextD = { ...d, bgImageUrl: uploaded.url, bgImageStoragePath: uploaded.storagePath, bgImageAssetId: uploaded.assetId };
          frontChanged = true;
        }
      }
      await this.persistFrontDesignDoc(nextD, uid);
      nextFronts.push(nextD);
    }
    if (frontChanged) {
      this.setItem(STORAGE_KEYS.FRONT_DESIGNS, JSON.stringify(nextFronts));
    }

    const backDesigns = this.getBackDesigns();
    let backChanged = false;
    const nextBacks = [];
    for (const d of backDesigns) {
      let nextD = d;
      if (d.bgImageUrl && d.bgImageUrl.startsWith('data:image/') && !d.bgImageUrl.startsWith('data:image/svg+xml')) {
        const file = dataUrlToFile(d.bgImageUrl, `back_${d.id}`);
        if (file) {
          const uploaded = await this.uploadCardDesignImage(file, 'back', d.id);
          nextD = { ...d, bgImageUrl: uploaded.url, bgImageStoragePath: uploaded.storagePath, bgImageAssetId: uploaded.assetId };
          backChanged = true;
        }
      }
      await this.persistBackDesignDoc(nextD, uid);
      nextBacks.push(nextD);
    }
    if (backChanged) {
      this.setItem(STORAGE_KEYS.BACK_DESIGNS, JSON.stringify(nextBacks));
    }

    for (const st of this.getStudents()) {
      await this.persistStudentDoc(st, uid);
    }

    const guardians = this.getGuardians();
    let guardiansChanged = false;
    const nextGuardians = [];
    for (const gd of guardians) {
      let nextGd = gd;
      if (gd.photoUrl.startsWith('data:image/') && !gd.photoUrl.startsWith('data:image/svg+xml')) {
        const file = dataUrlToFile(gd.photoUrl, gd.photoFileName || gd.id);
        if (file) {
          const uploaded = await this.uploadGuardianPhoto(file, gd.photoFileName || file.name);
          nextGd = {
            ...gd,
            photoUrl: uploaded.photoUrl,
            photoFileName: uploaded.photoFileName,
            photoStoragePath: uploaded.photoStoragePath,
            photoAssetId: uploaded.photoAssetId,
          };
          guardiansChanged = true;
        }
      }
      await this.persistGuardianDoc(nextGd, uid);
      nextGuardians.push(nextGd);
    }
    if (guardiansChanged) {
      this.setItem(STORAGE_KEYS.GUARDIANS, JSON.stringify(nextGuardians));
    }

    for (const c of this.getCards()) {
      await this.persistCardDoc(c, uid);
    }
    for (const h of this.getPrintHistory()) {
      await this.persistPrintHistoryDoc(h, uid);
    }
    for (const asset of this.getImageAssets()) {
      if (!this.knownImageAssetIds.has(asset.id)) {
        await this.persistImageAssetDoc(asset, uid);
      }
    }
    this.lastSyncedAt = new Date().toISOString();
    this.lastSyncError = null;
    this.notifyListeners();
  }

  /**
   * Clear student/guardian/card/history data and reset system defaults in both cache & Firebase
   */
  public async resetToFactoryDefaults(): Promise<void> {
    // Clean up Storage objects from guardians & custom templates
    for (const g of this.getGuardians()) {
      if (g.photoStoragePath) {
        await this.deleteStorageObjectQuietly(g.photoStoragePath);
      }
    }
    for (const f of this.getFrontDesigns()) {
      if (f.bgImageStoragePath) {
        await this.deleteStorageObjectQuietly(f.bgImageStoragePath);
      }
    }
    for (const b of this.getBackDesigns()) {
      if (b.bgImageStoragePath) {
        await this.deleteStorageObjectQuietly(b.bgImageStoragePath);
      }
    }
    const samplePath = this.getItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
    if (samplePath) {
      await this.deleteStorageObjectQuietly(samplePath);
    }

    this.removeItem(STORAGE_KEYS.JUNIOR_DESIGN);
    this.removeItem(STORAGE_KEYS.SENIOR_DESIGN);
    this.removeItem(STORAGE_KEYS.BACK_DESIGN);
    this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO);
    this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_PATH);
    this.removeItem(STORAGE_KEYS.DESIGNER_SAMPLE_PHOTO_ASSET_ID);
    this.removeItem(STORAGE_KEYS.IMAGE_ASSETS);
    this.cloudImageAssets = [];
    this.knownImageAssetIds.clear();

    const activeUid = this.getCurrentUid();
    const isAdminUser = this.isUserBootstrappedAdmin(this.activeUser || auth.currentUser);
    const defaultJuniorId =
      activeUid && !isAdminUser
        ? `${DEFAULT_JUNIOR_DESIGN.id}_${sanitizeId(activeUid, 'u').slice(0, 24)}`
        : DEFAULT_JUNIOR_DESIGN.id;
    const defaultSeniorId =
      activeUid && !isAdminUser
        ? `${DEFAULT_SENIOR_DESIGN.id}_${sanitizeId(activeUid, 'u').slice(0, 24)}`
        : DEFAULT_SENIOR_DESIGN.id;
    const defaultBackId =
      activeUid && !isAdminUser
        ? `${DEFAULT_BACK_CARD_DESIGN.id}_${sanitizeId(activeUid, 'u').slice(0, 24)}`
        : DEFAULT_BACK_CARD_DESIGN.id;

    this.savePrintHistory([]);
    this.saveCards([]);
    this.saveGuardians([]);
    this.saveStudents([]);
    this.saveFrontDesigns([
      { ...DEFAULT_JUNIOR_DESIGN, id: defaultJuniorId, isDefault: true },
      { ...DEFAULT_SENIOR_DESIGN, id: defaultSeniorId, isDefault: true },
    ]);
    this.saveBackDesigns([{ ...DEFAULT_BACK_CARD_DESIGN, id: defaultBackId, isDefault: true }]);
    this.saveTrayConfig(DEFAULT_TRAY_CONFIG);
    this.setAcademicYear(2569);

    const uid = activeUid;
    if (uid) {
      // Ensure any extra Firestore docs not in cache are also removed cleanly
      try {
        const colsToClear = ['cards', 'guardians', 'students', 'print_history', 'image_assets'];
        for (const colName of colsToClear) {
          const q = isAdminUser
            ? collection(db, colName)
            : query(collection(db, colName), where('ownerId', '==', uid));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
          }
        }
        const frontDefaults = new Set([defaultJuniorId, defaultSeniorId]);
        const frontSnap = await getDocs(
          isAdminUser
            ? collection(db, 'front_designs')
            : query(collection(db, 'front_designs'), where('ownerId', '==', uid))
        );
        for (const d of frontSnap.docs) {
          if (!frontDefaults.has(d.id)) {
            await deleteDoc(d.ref);
          }
        }
        const backSnap = await getDocs(
          isAdminUser
            ? collection(db, 'back_designs')
            : query(collection(db, 'back_designs'), where('ownerId', '==', uid))
        );
        for (const d of backSnap.docs) {
          if (d.id !== defaultBackId) {
            await deleteDoc(d.ref);
          }
        }
        // Check settings doc exists
        await getDoc(doc(db, 'system_settings', this.getSettingsDocId(this.activeUser || auth.currentUser)));
      } catch (e) {
        console.warn('Firestore factory cleanup note:', e);
      }
    }
    this.notifyListeners();
  }
}

export const storageService = new StorageService();
