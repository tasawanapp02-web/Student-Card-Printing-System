import React from 'react';
import { AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react';
import { firebaseConfig } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
  pathInfo?: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isPermissionError: false,
      pathInfo: null,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const rawMsg = error instanceof Error ? error.message : String(error);
    let parsedError = rawMsg;
    let pathInfo: string | null = null;
    try {
      const obj = JSON.parse(rawMsg);
      if (obj && typeof obj.error === 'string') {
        parsedError = obj.error;
        pathInfo = typeof obj.path === 'string' ? obj.path : null;
      }
    } catch {
      // Not JSON formatted error
    }

    const lower = parsedError.toLowerCase();
    const isPermissionError =
      lower.includes('permission') ||
      lower.includes('insufficient permissions') ||
      lower.includes('missing or insufficient');

    return {
      hasError: true,
      errorMessage: parsedError,
      isPermissionError,
      pathInfo,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-prompt">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {this.state.isPermissionError
                ? 'ไม่สามารถเข้าถึงข้อมูล Firebase ได้เนื่องจากสิทธิ์ไม่เพียงพอ'
                : 'เกิดข้อผิดพลาดในการทำงานของระบบ'}
            </h1>
            <p className="text-xs text-slate-500 font-sarabun mt-1 leading-relaxed">
              {this.state.isPermissionError
                ? 'กรุณาตรวจสอบว่าคุณเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต (เช่น Google Account ผู้ดูแลระบบ) และได้เผยแพร่กฎความปลอดภัย Firestore Rules ล่าสุดแล้ว'
                : 'ระบบตรวจพบข้อผิดพลาดชั่วคราว คุณสามารถลองรีเฟรชหน้าเว็บเพื่อกลับมาใช้งานต่อได้'}
            </p>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-700 break-words space-y-1">
            {this.state.pathInfo && (
              <div className="text-slate-500">Path: {this.state.pathInfo}</div>
            )}
            <div>{this.state.errorMessage}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>โหลดหน้าเว็บใหม่</span>
            </button>
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
            >
              <span>เปิดฐานข้อมูล Firebase</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }
}
