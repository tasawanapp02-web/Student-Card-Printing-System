import React, { useState, useEffect } from 'react';
import { UserAccount } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { storageService } from './utils/storage';
import { Navbar, MainTabType } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { PvcPrintView } from './components/PvcPrintView';
import { PvcBackPrintView } from './components/PvcBackPrintView';
import { GuardianPhotoPrintView } from './components/GuardianPhotoPrintView';
import { PrintPreviewTab } from './components/PrintPreviewTab';
import { GuardiansView } from './components/GuardiansView';
import { GuardianCardRegistryView } from './components/GuardianCardRegistryView';
import { StudentsView } from './components/StudentsView';
import { CardDesigner } from './components/CardDesigner';
import { TemplateManagementView } from './components/TemplateManagementView';
import { PrintHistoryView } from './components/PrintHistoryView';
import { SettingsModal } from './components/SettingsModal';
import { ExportStandaloneModal } from './components/ExportStandaloneModal';
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from 'lucide-react';

export default function App() {
  const [isStorageReady, setIsStorageReady] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribeAuth: (() => void) | undefined;

    storageService.ready().then(() => {
      if (!active) return;
      setIsStorageReady(true);

      unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
        if (!active) return;
        if (fbUser && storageService.isAuthorizedFirebaseUser(fbUser)) {
          setIsSyncingCloud(true);
          try {
            await storageService.initRealtimeSync(fbUser);
            const account = storageService.buildUserAccountFromFirebaseUser(fbUser);
            storageService.setCurrentUser(account);
            if (active) setCurrentUser(account);
          } catch (e) {
            console.error('Firebase sync initialization error:', e);
          } finally {
            if (active) {
              setIsSyncingCloud(false);
              setIsAuthReady(true);
            }
          }
        } else {
          storageService.stopRealtimeSync(true);
          storageService.setCurrentUser(null);
          if (active) {
            setCurrentUser(null);
            setIsSyncingCloud(false);
            setIsAuthReady(true);
          }
        }
      });
    });

    return () => {
      active = false;
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  if (!isStorageReady || !isAuthReady || isSyncingCloud) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 font-prompt text-slate-600 text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span>
          {isSyncingCloud
            ? 'กำลังซิงค์ข้อมูลและแม่แบบจาก Firebase...'
            : 'กำลังโหลดข้อมูลระบบ...'}
        </span>
      </div>
    );
  }

  const isPrintPreviewMode = (() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('printPreview');
    return mode === 'front' || mode === 'back' || mode === 'photo' || mode === 'registry';
  })();

  if (isPrintPreviewMode) {
    return <PrintPreviewTab />;
  }

  return (
    <MainAppContent
      currentUser={currentUser}
      onUserChange={setCurrentUser}
    />
  );
}

interface MainAppContentProps {
  currentUser: UserAccount | null;
  onUserChange: (user: UserAccount | null) => void;
}

function MainAppContent({ currentUser, onUserChange }: MainAppContentProps) {
  const [activeTab, setActiveTab] = useState<MainTabType>('pvcPrint');
  const [reprintCardId, setReprintCardId] = useState<string | null>(null);
  const [designerTarget, setDesignerTarget] = useState<{
    side: 'front' | 'back';
    templateId: string;
    nonce: number;
  } | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    return storageService.subscribe(() => {
      const fbUser = auth.currentUser;
      if (!fbUser || !storageService.isAuthorizedFirebaseUser(fbUser)) return;
      const latest = storageService.buildUserAccountFromFirebaseUser(fbUser);
      if (
        latest.fullName !== currentUser.fullName ||
        latest.position !== currentUser.position ||
        latest.username !== currentUser.username ||
        latest.isActive !== currentUser.isActive
      ) {
        storageService.setCurrentUser(latest);
        onUserChange(latest);
      }

      const syncState = storageService.getCloudSyncState();
      if (syncState.lastSyncError) {
        showToast(`ซิงค์ Firebase มีข้อผิดพลาด: ${syncState.lastSyncError}`, 'error');
        storageService.clearSyncError();
      }
    });
  }, [currentUser, onUserChange]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    storageService.stopRealtimeSync(true);
    storageService.setCurrentUser(null);
    onUserChange(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  const handleReprintCard = (cardId: string) => {
    if (cardId === 'back_card_template') {
      setActiveTab('pvcPrintBack');
      return;
    }
    setReprintCardId(cardId);
    setActiveTab('pvcPrint');
  };

  const handleSendCardToPrintTray = (cardId: string) => {
    setReprintCardId(cardId);
    setActiveTab('pvcPrint');
    showToast('ดึงข้อมูลบัตรลงสู่ถาดพิมพ์เรียบร้อยแล้ว', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-prompt selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-white animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
          <span className="text-xs font-semibold text-slate-800 font-sarabun max-w-sm">
            {toast.message}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Login Screen if not logged in */}
      {!currentUser ? (
        <LoginModal
          onLoginSuccess={(user) => {
            onUserChange(user);
          }}
          onNotify={showToast}
        />
      ) : (
        <>
          {/* Main Top Navigation */}
          <Navbar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
            }}
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />

          {/* Main Workspace Body */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:max-w-none print:w-full">
            {activeTab === 'pvcPrint' && (
              <PvcPrintView
                currentUser={currentUser}
                onNotify={showToast}
                reprintCardId={reprintCardId}
                onReprintLoaded={() => setReprintCardId(null)}
              />
            )}

            {activeTab === 'pvcPrintBack' && (
              <PvcBackPrintView
                currentUser={currentUser}
                onNotify={showToast}
              />
            )}

            {activeTab === 'photoPrint' && (
              <GuardianPhotoPrintView onNotify={showToast} />
            )}

            {activeTab === 'cards' && (
              <GuardiansView
                onNotify={showToast}
                onSendCardToPrintTray={handleSendCardToPrintTray}
              />
            )}

            {activeTab === 'cardRegistry' && (
              <GuardianCardRegistryView
                onNotify={showToast}
                onSendCardToPrintTray={handleSendCardToPrintTray}
              />
            )}

            {activeTab === 'students' && (
              <StudentsView
                onNotify={showToast}
                onNavigateToCardsForStudent={() => setActiveTab('cards')}
              />
            )}

            {activeTab === 'designer' && (
              <CardDesigner
                onNotify={showToast}
                initialTarget={designerTarget}
              />
            )}

            {activeTab === 'templates' && (
              <TemplateManagementView
                onNotify={showToast}
                onEditInDesigner={(side, templateId) => {
                  setDesignerTarget({ side, templateId, nonce: Date.now() });
                  setActiveTab('designer');
                }}
              />
            )}

            {activeTab === 'history' && (
              <PrintHistoryView
                onNotify={showToast}
                onReprintCard={handleReprintCard}
              />
            )}
          </main>

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onNotify={showToast}
            onDataReset={() => {
              setActiveTab('pvcPrint');
            }}
          />

          {/* GitHub Pages Export Modal */}
          <ExportStandaloneModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            onNotify={showToast}
          />
        </>
      )}
    </div>
  );
}
