import React, { useState } from 'react';
import { UserAccount } from '../types';
import { firebaseConfig } from '../firebase';
import { storageService } from '../utils/storage';
import {
  Lock,
  ShieldCheck,
  Loader2,
  User,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  LogIn,
} from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (user: UserAccount) => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  onNotify,
}) => {
  const [username, setUsername] = useState<string>(
    () => storageService.getRememberedUsername() || ''
  );
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() =>
    Boolean(storageService.getRememberedUsername())
  );
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<{
    message: string;
    needsEmailPasswordSetup?: boolean;
  } | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!username.trim() || !password) {
      setAuthError({ message: 'กรุณากรอกชื่อผู้ใช้ (User) และรหัสผ่าน (Password)' });
      return;
    }

    setIsSigningIn(true);
    try {
      const account = await storageService.loginWithUsernameAndPassword(
        username,
        password
      );
      if (rememberMe) {
        storageService.setRememberedUsername(username);
      } else {
        storageService.setRememberedUsername('');
      }
      onLoginSuccess(account);
      onNotify(`ยินดีต้อนรับ ${account.fullName}`, 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError({
          message:
            'โปรเจกต์ Firebase ยังไม่ได้เปิดใช้งานวิธีเข้าสู่ระบบแบบ Email/Password ใน Firebase Console กรุณาเปิดใช้งานที่เมนู Authentication > Sign-in method ก่อนเข้าสู่ระบบ',
          needsEmailPasswordSetup: true,
        });
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setAuthError({
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
        });
      } else if (code === 'auth/too-many-requests') {
        setAuthError({
          message: 'มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
        });
      } else if (code === 'auth/weak-password') {
        setAuthError({
          message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
        });
      } else {
      const msg =
          err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        setAuthError({ message: msg });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const account = await storageService.loginWithGoogle();
      onLoginSuccess(account);
      onNotify(`เข้าสู่ระบบด้วย Google สำเร็จ (${account.fullName})`, 'success');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError({ message: 'ยกเลิกการเข้าสู่ระบบด้วย Google' });
      } else if (code === 'auth/popup-blocked') {
        setAuthError({
          message: 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ Google กรุณาอนุญาตป๊อปอัปแล้วลองใหม่',
        });
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError({
          message: 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication > Settings > Authorized domains',
        });
      } else {
        const msg =
          err instanceof Error ? err.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ';
        setAuthError({ message: msg });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Branding */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-6 text-white text-center relative overflow-hidden">
          <div className="w-14 h-14 bg-white/10 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-md mb-3 border border-white/20 shadow-inner">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-bold">ระบบพิมพ์บัตรรับส่งนักเรียน</h2>
          <p className="text-xs text-blue-100 mt-1 font-sarabun">
            Student Pickup Card Management &amp; PVC Printing System
          </p>
        </div>

        {/* Sign-In Body */}
        <div className="p-6 space-y-4">
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2 font-sarabun">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{authError.message}</span>
              </div>
              {authError.needsEmailPasswordSetup && (
                <div className="space-y-2 pt-1">
                  <ol className="list-decimal pl-5 space-y-1 text-[11px] text-rose-900">
                    <li>เปิดหน้า Sign-in method ใน Firebase Console จากปุ่มด้านล่าง</li>
                    <li>กด &quot;Add new provider&quot; แล้วเลือก &quot;Email/Password&quot;</li>
                    <li>เปิดสวิตช์ &quot;Enable&quot; แล้วกด &quot;Save&quot;</li>
                  </ol>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-[11px] transition-colors"
                  >
                    <span>เปิดหน้าตั้งค่า Email/Password ใน Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Google Account Sign-In */}
          <button
            type="button"
            disabled={isSigningIn}
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>เข้าสู่ระบบด้วย Google Account (Admin)</span>
          </button>

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[10px] font-medium text-slate-400 font-sarabun">
              หรือเข้าสู่ระบบด้วย User / Password
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อผู้ใช้ (User)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoComplete="username"
                  disabled={isSigningIn}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้ เช่น admin"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSigningIn}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-sarabun">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>จดจำชื่อผู้ใช้</span>
              </label>
              <span className="text-slate-400">จัดการผู้ใช้ได้ที่ &quot;ตั้งค่าระบบ&quot;</span>
            </div>

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-3 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังตรวจสอบสิทธิ์และเข้าสู่ระบบ...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-sarabun pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>ยืนยันตัวตนผ่าน Firebase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};

