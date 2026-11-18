import React, { useState, useEffect } from 'react';
import { storageService, CloudSyncState } from '../utils/storage';
import { ADMIN_EMAIL } from '../firebase';
import { OperatorAccount } from '../types';
import { FirebaseImagePickerModal } from './FirebaseImagePickerModal';
import {
  Settings,
  Database,
  Cloud,
  CheckCircle2,
  RotateCcw,
  Save,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Pencil,
  FileCode2,
  FolderOpen,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onDataReset: () => void;
}

const RECOMMENDED_STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthorizedUser() {
      return request.auth != null && (
        request.auth.token.email_verified == true ||
        request.auth.token.firebase.sign_in_provider == 'password'
      );
    }
    function isBootstrappedAdmin() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email == '${ADMIN_EMAIL}';
    }
    match /card_designs/{uid}/{allPaths=**} {
      allow read, write: if isAuthorizedUser() && (request.auth.uid == uid || isBootstrappedAdmin());
    }
    match /guardians/{uid}/{allPaths=**} {
      allow read, write: if isAuthorizedUser() && (request.auth.uid == uid || isBootstrappedAdmin());
    }
    match /system_settings/{uid}/{allPaths=**} {
      allow read, write: if isAuthorizedUser() && (request.auth.uid == uid || isBootstrappedAdmin());
    }
  }
}`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNotify,
  onDataReset,
}) => {
  const [activeTab, setActiveTab] = useState<'firebase' | 'users'>('firebase');
  const [academicYear, setAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear()
  );
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isCheckingPerms, setIsCheckingPerms] = useState<boolean>(false);
  const [permCheckResult, setPermCheckResult] = useState<{
    authOk: boolean;
    firestoreOk: boolean;
    storageOk: boolean;
    authMethod: string;
    firestoreError?: string;
    storageError?: string;
  } | null>(null);
  const [copiedRules, setCopiedRules] = useState<boolean>(false);
  const [showStorageGuide, setShowStorageGuide] = useState<boolean>(false);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<CloudSyncState>(() =>
    storageService.getCloudSyncState()
  );

  // User & Password management state
  const [operators, setOperators] = useState<OperatorAccount[]>(() =>
    storageService.getOperatorAccounts()
  );
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPosition, setNewPosition] = useState<string>('เจ้าหน้าที่งานบัตรนักเรียน');
  const [grantAdmin, setGrantAdmin] = useState<boolean>(false);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  // Change own password state
  const [updatedPassword, setUpdatedPassword] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);

  // Admin recovery & inline operator edit state
  const [isRestoringAdmin, setIsRestoringAdmin] = useState<boolean>(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const status = storageService.getFirebaseStatus();
  const firestoreConsoleUrl = `https://console.firebase.google.com/project/${status.projectId}/firestore/databases/${status.databaseId}/data`;
  const isBootstrappedGoogleAdmin =
    status.authMethod === 'google' && status.userEmail === ADMIN_EMAIL;
  const systemAdminFile = storageService.getSystemAdminRecoveryProfile();
  const cloudAdminOp = operators.find(
    (op) =>
      op.username.toLowerCase() === systemAdminFile.username.toLowerCase() ||
      op.email.toLowerCase() === systemAdminFile.email.toLowerCase()
  );
  const canRestoreSystemAdmin =
    isBootstrappedGoogleAdmin ||
    (status.userEmail || '').toLowerCase() === systemAdminFile.email.toLowerCase() ||
    Boolean(cloudAdminOp);

  useEffect(() => {
    if (isOpen) {
      setAcademicYear(storageService.getAcademicYear());
      setOperators(storageService.getOperatorAccounts());
      setSyncState(storageService.getCloudSyncState());
    }
  }, [isOpen]);

  useEffect(() => {
    return storageService.subscribe(() => {
      setAcademicYear(storageService.getAcademicYear());
      setOperators(storageService.getOperatorAccounts());
      setSyncState(storageService.getCloudSyncState());
    });
  }, []);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    storageService.setAcademicYear(academicYear);
    onNotify(
      'บันทึกปีการศึกษาและการตั้งค่าลงใน Firebase Firestore เรียบร้อยแล้ว',
      'success'
    );
    onClose();
  };

  const handleForceSyncAndVerify = async () => {
    setIsSyncing(true);
    setIsCheckingPerms(true);
    try {
      const result = await storageService.verifyFirebasePermissions();
      setPermCheckResult(result);
      setSyncState(storageService.getCloudSyncState());
      if (result.firestoreOk && result.storageOk) {
        onNotify(
          'ซิงค์ข้อมูล การตั้งค่า แม่แบบบัตร และรูปภาพทั้งหมดขึ้น Firebase Firestore & Storage สำเร็จครบถ้วน',
          'success'
        );
      } else if (result.firestoreOk && !result.storageOk) {
        onNotify(
          'ซิงค์ข้อมูล การตั้งค่า การออกแบบ และรูปภาพลง Firestore (image_assets) เรียบร้อยแล้ว (Storage ยังไม่เปิดใช้งาน ระบบใช้ Firestore เก็บรูปให้อัตโนมัติ)',
          'success'
        );
      } else {
        onNotify(
          result.firestoreError || 'ไม่สามารถเชื่อมต่อ Firebase ได้ครบถ้วน',
          'error'
        );
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถซิงค์ข้อมูลขึ้น Firebase ได้',
        'error'
      );
    } finally {
      setIsSyncing(false);
      setIsCheckingPerms(false);
    }
  };

  const handleCopyStorageRules = async () => {
    try {
      await navigator.clipboard.writeText(RECOMMENDED_STORAGE_RULES);
      setCopiedRules(true);
      onNotify('คัดลอก Storage Rules เรียบร้อยแล้ว', 'success');
      setTimeout(() => setCopiedRules(false), 2500);
    } catch {
      onNotify('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกจากกล่องข้อความ', 'error');
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      onNotify('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error');
      return;
    }

    setIsCreatingUser(true);
    try {
      const created = await storageService.createOperatorAccount({
        username: newUsername,
        email: newEmail || undefined,
        password: newPassword,
        fullName: newFullName || newUsername,
        position: newPosition,
        grantAdmin,
      });
      setOperators(storageService.getOperatorAccounts());
      setNewUsername('');
      setNewPassword('');
      setNewEmail('');
      setNewFullName('');
      setGrantAdmin(false);
      onNotify(
        `สร้างบัญชี "${created.username}" (${created.email}) และให้สิทธิ์ Firebase อัตโนมัติเรียบร้อยแล้ว`,
        'success'
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        onNotify('อีเมลหรือชื่อผู้ใช้นี้มีอยู่แล้วในระบบ Firebase Auth', 'error');
      } else if (code === 'auth/operation-not-allowed') {
        onNotify(
          'กรุณาเปิดใช้งาน Email/Password ใน Firebase Console ก่อนสร้างบัญชี',
          'error'
        );
      } else {
        onNotify(
          err instanceof Error ? err.message : 'สร้างบัญชีผู้ใช้งานไม่สำเร็จ',
          'error'
        );
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteOperator = async (op: OperatorAccount) => {
    try {
      await storageService.deleteOperatorAccountRecord(op.id);
      onNotify(`ลบข้อมูลบัญชี "${op.username}" ออกจาก Firebase Firestore แล้ว`, 'info');
    } catch {
      onNotify('ไม่สามารถลบบัญชีผู้ใช้งานได้', 'error');
    }
  };

  const handleStartEditOp = (op: OperatorAccount) => {
    setEditingOpId(op.id);
    setEditFullName(op.fullName);
    setEditPosition(op.position);
    setEditIsActive(op.isActive !== false);
  };

  const handleCancelEditOp = () => {
    setEditingOpId(null);
    setEditFullName('');
    setEditPosition('');
    setEditIsActive(true);
  };

  const handleSaveEditOp = async (op: OperatorAccount) => {
    if (!editFullName.trim()) {
      onNotify('กรุณากรอกชื่อ-นามสกุล', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await storageService.updateOperatorAccount(op.id, {
        fullName: editFullName,
        position: editPosition,
        isActive: op.uid === status.uid ? true : editIsActive,
      });
      setOperators(storageService.getOperatorAccounts());
      handleCancelEditOp();
      onNotify(`อัปเดตข้อมูลบัญชี "${op.username}" ลงใน Firebase เรียบร้อยแล้ว`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปเดตข้อมูลบัญชีใน Firebase ได้',
        'error'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRestoreSystemAdmin = async () => {
    setIsRestoringAdmin(true);
    try {
      const restored = await storageService.restoreSystemAdminToFirebase();
      setOperators(storageService.getOperatorAccounts());
      onNotify(
        `กู้คืนชื่อ "${restored.fullName}" (@${restored.username}) จากไฟล์ระบบลงฐานข้อมูล Firebase เรียบร้อยแล้ว`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถกู้คืนข้อมูลผู้ดูแลระบบลง Firebase ได้',
        'error'
      );
    } finally {
      setIsRestoringAdmin(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updatedPassword.length < 6) {
      onNotify('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await storageService.changeCurrentPassword(updatedPassword);
      setUpdatedPassword('');
      onNotify('เปลี่ยนรหัสผ่านใน Firebase Auth เรียบร้อยแล้ว', 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/requires-recent-login') {
        onNotify(
          'กรุณาออกจากระบบและเข้าสู่ระบบใหม่อีกครั้งก่อนเปลี่ยนรหัสผ่าน',
          'error'
        );
      } else {
        onNotify(
          err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้',
          'error'
        );
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleConfirmResetFactory = async () => {
    setIsSyncing(true);
    try {
      await storageService.resetToFactoryDefaults();
      setIsResetConfirmOpen(false);
      onDataReset();
      onNotify(
        'ล้างข้อมูลและคืนค่าเริ่มต้นทั้งในเครื่องและ Firebase เรียบร้อยแล้ว',
        'info'
      );
      onClose();
    } catch {
      onNotify('เกิดข้อผิดพลาดระหว่างล้างข้อมูลบางส่วน', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                การตั้งค่าระบบ บัญชีผู้ใช้ และสิทธิ์ Firebase
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                จัดการสิทธิ์เชื่อมต่อ Firestore Database & Firebase Storage อัตโนมัติ และบัญชี User / Password
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('firebase')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'firebase'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>เชื่อมต่อ Firebase & ระบบ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>บัญชีผู้ใช้ (User & Password)</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-200/80 text-slate-700">
              {operators.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {activeTab === 'firebase' ? (
            <>
              {/* Current Status Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span>สิทธิ์การเชื่อมต่อ Firebase อัตโนมัติ</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowStorageGuide((prev) => !prev)}
                      className="text-slate-600 hover:text-blue-700 text-[11px] font-semibold underline cursor-pointer"
                    >
                      {showStorageGuide ? 'ซ่อนคู่มือกฎ Storage' : 'ดูกฎ Storage / Auth Rules'}
                    </button>
                    <a
                      href={firestoreConsoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold text-[11px]"
                    >
                      เปิดฐานข้อมูล Firestore Console
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">
                        Firebase Firestore ({syncState.isCloudSynced ? 'Synced' : 'Connecting'})
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        Project: {status.projectId}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        DB: {status.databaseId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200">
                    <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">
                        คลังรูปภาพ Unified (Firestore + Storage)
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        {status.storageBucket}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-sarabun">
                        บีบอัดและเก็บใน Firestore (image_assets) + Storage อัตโนมัติ
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Firestore Collections Summary */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-slate-700 text-[11px]">
                      สรุปข้อมูล การออกแบบ การตั้งค่า และรูปภาพบนฐานข้อมูล Firebase
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                      {syncState.pendingWrites > 0 ? (
                        <span className="text-blue-600 font-bold">
                          กำลังบันทึก {syncState.pendingWrites} รายการ...
                        </span>
                      ) : syncState.lastSyncedAt ? (
                        <span className="text-emerald-700">
                          ซิงค์ล่าสุด {new Date(syncState.lastSyncedAt).toLocaleTimeString('th-TH')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center font-sarabun">
                    {[
                      { label: 'นักเรียน', count: syncState.counts.students },
                      { label: 'ผู้ปกครอง', count: syncState.counts.guardians },
                      { label: 'บัตรรับส่ง', count: syncState.counts.cards },
                      { label: 'แบบหน้าบัตร', count: syncState.counts.frontDesigns },
                      { label: 'แบบหลังบัตร', count: syncState.counts.backDesigns },
                      { label: 'ไฟล์รูปภาพ', count: syncState.counts.imageAssets },
                      { label: 'ประวัติพิมพ์', count: syncState.counts.printHistory },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div className="text-sm font-bold font-mono text-blue-700">
                          {item.count}
                        </div>
                        <div className="text-[10px] text-slate-600 truncate">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 font-sarabun flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>บัญชีที่ยืนยันสิทธิ์แล้ว:</span>
                    <strong className="font-mono text-slate-800">
                      {status.userEmail || '-'}
                    </strong>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold text-[10px]">
                      {status.authMethod === 'password' ? 'User & Password' : 'Google Auth'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsImageLibraryOpen(true)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>คลังรูป Firebase ({syncState.counts.imageAssets})</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing || isCheckingPerms}
                      onClick={handleForceSyncAndVerify}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isSyncing || isCheckingPerms ? 'animate-spin' : ''}`}
                      />
                      <span>ซิงค์ข้อมูลและรูปภาพขึ้น Firebase</span>
                    </button>
                  </div>
                </div>

                {/* Live Permission Verification Result */}
                {permCheckResult && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-[11px] font-sarabun">
                    <div className="font-bold text-slate-700">
                      ผลการทดสอบสิทธิ์เชื่อมต่อล่าสุด ({permCheckResult.authMethod}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div
                        className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                          permCheckResult.authOk
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {permCheckResult.authOk ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>Firebase Auth: {permCheckResult.authOk ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
                      </div>
                      <div
                        className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                          permCheckResult.firestoreOk
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {permCheckResult.firestoreOk ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          Firestore DB: {permCheckResult.firestoreOk ? 'อ่าน/เขียนผ่าน' : 'ติดสิทธิ์'}
                        </span>
                      </div>
                      <div
                        className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                          permCheckResult.storageOk
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        {permCheckResult.storageOk ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          Storage: {permCheckResult.storageOk ? 'อัปโหลดผ่าน' : 'ต้องตั้งกฎ Storage'}
                        </span>
                      </div>
                    </div>
                    {permCheckResult.storageError && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                        หมายเหตุ Storage: {permCheckResult.storageError}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Guided Firebase Storage & Email/Password Setup Panel */}
              {showStorageGuide && (
                <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>ตั้งค่าสิทธิ์ Firebase Console (ทำครั้งเดียวเพื่อให้ User/Password และ Storage ทำงานอัตโนมัติ)</span>
                    </div>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-[11px] text-amber-950 font-sarabun">
                    <li>
                      เปิดใช้งานการเข้าสู่ระบบด้วย User &amp; Password ที่{' '}
                      <a
                        href={`https://console.firebase.google.com/project/${status.projectId}/authentication/providers`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline font-semibold inline-flex items-center gap-1"
                      >
                        Authentication &gt; Sign-in method &gt; Email/Password (Enable)
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      เปิดสิทธิ์จัดเก็บรูปภาพที่{' '}
                      <a
                        href={`https://console.firebase.google.com/project/${status.projectId}/storage/rules`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline font-semibold inline-flex items-center gap-1"
                      >
                        Firebase Storage &gt; Rules
                        <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      แล้ววางกฎด้านล่างนี้:
                    </li>
                  </ol>
                  <div className="relative">
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed">
                      {RECOMMENDED_STORAGE_RULES}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyStorageRules}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedRules ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>คัดลอกกฎ Storage</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-5">
                {/* Academic Year */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <label className="block font-bold text-slate-800">
                    ปีการศึกษาปัจจุบัน (พ.ศ.) สำหรับคำนวณระดับชั้นอัตโนมัติ
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={2560}
                      max={2590}
                      value={academicYear}
                      onChange={(e) =>
                        setAcademicYear(parseInt(e.target.value, 10) || 2569)
                      }
                      className="w-32 px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm font-bold text-blue-600"
                    />
                    <span className="text-slate-500 font-sarabun">
                      ระบบจะบันทึกปีการศึกษานี้ใน Firestore (system_settings) และใช้ซิงค์ข้ามอุปกรณ์อัตโนมัติ
                    </span>
                  </div>
                </div>

                {/* Image Compression Policy Info */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1.5">
                  <div className="font-bold text-emerald-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    นโยบายการบีบอัดและจัดเก็บรูปภาพลงฐานข้อมูล Firebase (Firestore + Storage)
                  </div>
                  <p className="text-[11px] text-emerald-900/80 font-sarabun leading-relaxed">
                    ภาพพื้นหลังบัตร (หน้า-หลัง) จะถูกย่อขนาดและบีบอัดโดยคงความโปร่งใสของช่องรูปถ่าย ส่วนรูปถ่ายผู้ปกครองจะถูกย่อขนาดอัตโนมัติ แล้วบันทึกเข้าคอลเลกชัน <span className="font-mono font-bold">image_assets</span> ใน Firebase Firestore (และซิงค์ขึ้น Firebase Storage ควบคู่กันหากเปิดสิทธิ์ไว้) เพื่อให้เรียกใช้ซ้ำจากคลังรูปภาพได้ทันทีทุกเครื่อง
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ล้างข้อมูลและคืนค่าเริ่มต้น (Reset System)
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                    >
                      ปิด
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      บันทึกการตั้งค่า
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            /* Tab 2: User & Password Management */
            <div className="space-y-5">
              {/* Direct Firestore Storage Policy */}
              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-start gap-2.5">
                <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-950 font-sarabun leading-relaxed">
                  <strong>บันทึกข้อมูลบัญชีผู้ใช้ลงฐานข้อมูล Firebase โดยตรง:</strong>{' '}
                  บัญชีผู้ใช้งานทั้งหมดถูกจัดเก็บและซิงค์ตรงกับคอลเลกชัน{' '}
                  <span className="font-mono font-semibold">operator_accounts</span> ใน Firebase Firestore (ไม่เก็บรายชื่อบัญชีใน LocalStorage)
                </div>
              </div>

              {/* Canonical System Admin Recovery (1 copy in System File <-> 1 copy in Firebase) */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <FileCode2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-950">
                        บัญชีผู้ดูแลระบบสำหรับกู้คืน (ไฟล์ระบบ 1 ชุด ↔ ฐานข้อมูล Firebase 1 ชุด)
                      </div>
                      <div className="text-[11px] text-amber-900/80 font-sarabun mt-0.5">
                        ระบบบันทึกข้อมูลตั้งต้นของผู้ดูแลระบบไว้ในไฟล์ระบบเพื่อใช้กู้คืนอัตโนมัติ และซิงค์คู่กับฐานข้อมูล Firebase Firestore
                      </div>
                    </div>
                  </div>
                  {canRestoreSystemAdmin && (
                    <button
                      type="button"
                      disabled={isRestoringAdmin}
                      onClick={handleRestoreSystemAdmin}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-2xs"
                    >
                      {isRestoringAdmin ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>กู้คืน / ซิงค์ชื่อผู้ดูแลระบบลง Firebase</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-sarabun">
                  <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center justify-between gap-2">
                      <span>ชุดที่ 1: ไฟล์ระบบ (System File)</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                        defaultData.ts
                      </span>
                    </div>
                    <div className="text-slate-700">
                      ชื่อ: <strong>{systemAdminFile.fullName}</strong> ({systemAdminFile.position})
                    </div>
                    <div className="text-slate-500 font-mono text-[10px]">
                      @{systemAdminFile.username} • {systemAdminFile.email}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center justify-between gap-2">
                      <span>ชุดที่ 2: ฐานข้อมูล Firebase</span>
                      {cloudAdminOp ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                          เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold text-[10px]">
                          ยังไม่มีใน Firebase
                        </span>
                      )}
                    </div>
                    {cloudAdminOp ? (
                      <>
                        <div className="text-slate-700">
                          ชื่อ: <strong>{cloudAdminOp.fullName}</strong> ({cloudAdminOp.position})
                        </div>
                        <div className="text-slate-500 font-mono text-[10px]">
                          @{cloudAdminOp.username} • {cloudAdminOp.email}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500">
                        กดปุ่ม &quot;กู้คืน / ซิงค์ชื่อผู้ดูแลระบบลง Firebase&quot; เพื่อสร้างชุดข้อมูลใน Firestore
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Change Own Password (if logged in via Password) */}
              {status.authMethod === 'password' && (
                <form
                  onSubmit={handleChangeOwnPassword}
                  className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-3"
                >
                  <div className="font-bold text-blue-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>เปลี่ยนรหัสผ่านของบัญชีปัจจุบัน ({status.userEmail})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="password"
                      value={updatedPassword}
                      onChange={(e) => setUpdatedPassword(e.target.value)}
                      placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                      className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isUpdatingPassword ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>บันทึกรหัสผ่านใหม่</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Create New User & Password Account */}
              <form
                onSubmit={handleCreateOperator}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
              >
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>เพิ่มบัญชีผู้ใช้งานใหม่ (บันทึกลง Firebase Auth + Firestore โดยตรง)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ชื่อผู้ใช้ (Username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="เช่น staff01 (ภาษาอังกฤษ/ตัวเลข)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      รหัสผ่าน (Password อย่างน้อย 6 ตัว) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="กำหนดรหัสผ่าน"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ชื่อ-นามสกุล
                    </label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="เช่น นายสมศักดิ์ ใจดี"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ตำแหน่ง
                    </label>
                    <input
                      type="text"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      placeholder="เจ้าหน้าที่งานบัตรนักเรียน"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      อีเมลเชื่อมต่อ Firebase Auth (ไม่บังคับ - ค่าเริ่มต้นจะเป็น username@pcccr.ac.th)
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="staff01@pcccr.ac.th"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {isBootstrappedGoogleAdmin && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 font-sarabun cursor-pointer">
                    <input
                      type="checkbox"
                      checked={grantAdmin}
                      onChange={(e) => setGrantAdmin(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>ให้สิทธิ์ Admin ในคอลเลกชัน /admins ของ Firestore ด้วย</span>
                  </label>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isCreatingUser ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังสร้างบัญชีและกำหนดสิทธิ์...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>เพิ่มบัญชีผู้ใช้งาน</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Operator List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800">
                  รายชื่อบัญชีผู้ใช้ในฐานข้อมูล Firebase ({operators.length})
                </div>
                {operators.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 font-sarabun">
                    ยังไม่มีบัญชีผู้ใช้ในฐานข้อมูล Firebase Firestore (เมื่อเข้าสู่ระบบหรือเพิ่มบัญชี ข้อมูลจะบันทึกตรงลง Firestore ทันที)
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {operators.map((op) => {
                      const isSelf = op.uid === status.uid;
                      const canModify =
                        isBootstrappedGoogleAdmin || !op.ownerId || op.ownerId === status.uid;
                      const isEditing = editingOpId === op.id;

                      return (
                        <div key={op.id} className="p-3 bg-white space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                <span>{op.fullName}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[10px]">
                                  @{op.username}
                                </span>
                                {op.isActive === false ? (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-semibold">
                                    ระงับการใช้งาน
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-semibold">
                                    ใช้งานปกติ
                                  </span>
                                )}
                                {isSelf && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                                    บัญชีปัจจุบัน
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-sarabun mt-0.5 truncate">
                                {op.position} • <span className="font-mono">{op.email}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {canModify && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditOp(op)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                  title="แก้ไขข้อมูลบัญชีใน Firebase"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {canModify && !isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOperator(op)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="ลบรายชื่อออกจาก Firebase"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    ชื่อ-นามสกุล
                                  </label>
                                  <input
                                    type="text"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    ตำแหน่ง
                                  </label>
                                  <input
                                    type="text"
                                    value={editPosition}
                                    onChange={(e) => setEditPosition(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {!isSelf ? (
                                  <label className="flex items-center gap-2 text-[11px] text-slate-700 font-sarabun cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editIsActive}
                                      onChange={(e) => setEditIsActive(e.target.checked)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>เปิดใช้งานบัญชีนี้</span>
                                  </label>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-sarabun">
                                    บันทึกการเปลี่ยนแปลงตรงลง Firebase Firestore
                                  </span>
                                )}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditOp}
                                    className="px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingEdit}
                                    onClick={() => handleSaveEditOp(op)}
                                    className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                  >
                                    {isSavingEdit ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                    <span>บันทึกลง Firebase</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Reset Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  ยืนยันการล้างข้อมูลและคืนค่าเริ่มต้นระบบ
                </h4>
                <p className="text-xs text-slate-500 mt-1 font-sarabun leading-relaxed">
                  ข้อมูลนักเรียน ผู้ปกครอง บัตรรับส่ง ประวัติการพิมพ์ และไฟล์รูปภาพใน Firebase Storage ทั้งหมดจะถูกลบออก และตั้งค่าแม่แบบบัตรกลับสู่ค่ามาตรฐาน
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleConfirmResetFactory}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isSyncing ? 'กำลังล้างข้อมูล...' : 'ยืนยันล้างข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FirebaseImagePickerModal
        isOpen={isImageLibraryOpen}
        onClose={() => setIsImageLibraryOpen(false)}
        initialCategory="all"
        title="จัดการคลังรูปภาพทั้งหมดที่บันทึกบน Firebase Firestore"
        onNotify={onNotify}
      />
    </div>
  );
};
