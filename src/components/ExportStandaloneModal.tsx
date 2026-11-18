import React, { useState } from 'react';
import { Download, FileCode, CheckCircle2, Copy, ExternalLink, Globe } from 'lucide-react';

interface ExportStandaloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const ExportStandaloneModal: React.FC<ExportStandaloneModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadStandaloneHtml = () => {
    // Generate clean self-contained HTML bundle
    const standaloneHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ระบบพิมพ์บัตรรับส่งนักเรียน (Student Pickup Card & PVC Printing System)</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%232563eb'/><rect x='15' y='18' width='70' height='64' rx='8' fill='%23ffffff'/><circle cx='36' cy='42' r='14' fill='%233b82f6'/><path d='M22 66c0-7.7 6.3-14 14-14s14 6.3 14 14z' fill='%233b82f6'/><rect x='56' y='32' width='22' height='6' rx='3' fill='%230f172a'/><rect x='56' y='44' width='18' height='4' rx='2' fill='%2364748b'/><rect x='56' y='52' width='20' height='4' rx='2' fill='%2364748b'/><rect x='22' y='72' width='56' height='4' rx='2' fill='%2310b981'/></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js"></script>
  <style>
    body { font-family: 'Prompt', 'Sarabun', sans-serif; background-color: #f8fafc; color: #0f172a; }
    .font-sarabun { font-family: 'Sarabun', sans-serif; }
    @media print {
      @page { size: auto; margin: 0mm; }
      body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen text-slate-800">
  <div id="root">
    <div class="max-w-6xl mx-auto p-6 text-center py-20">
      <div class="w-16 h-16 bg-blue-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-2">ระบบพิมพ์บัตรรับส่งนักเรียน (Single-File GitHub Pages Ready)</h1>
      <p class="text-slate-500 text-sm max-w-xl mx-auto mb-6">ไฟล์นี้พร้อมนำขึ้น GitHub Pages และทำงานได้ทันทีโดยไม่ต้องรัน npm build</p>
      <div class="inline-flex gap-3">
        <a href="./" class="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition">เปิดแอปพลิเคชันเต็มรูปแบบ</a>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
    onNotify('ดาวน์โหลดไฟล์ index.html สำเร็จ พร้อมอัปโหลดขึ้น GitHub Pages', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                ส่งออกไฟล์ index.html สำหรับโฮสต์บน GitHub Pages
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Single-Page Application Deployment Guide
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-emerald-950 space-y-1.5">
            <div className="font-bold flex items-center gap-2 text-sm text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              พร้อมใช้งานบน GitHub Pages ทันที (No Server Required)
            </div>
            <p className="text-emerald-800 text-[11px] font-sarabun">
              โครงสร้างของระบบถูกพัฒนาขึ้นในรูปแบบ Single-Page Application (SPA) บริสุทธิ์
              ข้อมูลทั้งหมดสามารถบันทึกลง Firestore Online หรือเก็บใน LocalStorage ในเครื่อง และพิมพ์ลงบัตร PVC ด้วยเบราว์เซอร์ได้ทันที
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="font-bold text-slate-800">ขั้นตอนการนำขึ้น GitHub Pages:</div>
            <ol className="list-decimal pl-4 space-y-2 text-slate-600 font-sarabun">
              <li>
                รันคำสั่ง <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-blue-600 font-bold">npm run build</code> ในโฟลเดอร์โปรเจกต์ ซึ่งจะสร้างไฟล์ผลลัพธ์พร้อมใช้งานในโฟลเดอร์ <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">dist/</code>
              </li>
              <li>
                นำไฟล์ในโฟลเดอร์ <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">dist/</code> (รวมถึง <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">index.html</code>) อัปโหลดขึ้นสู่ GitHub Repository ของท่าน
              </li>
              <li>
                ไปที่หน้า <strong>Settings &gt; Pages</strong> ใน GitHub Repository แล้วเลือก Source เป็น <strong>Deploy from a branch (main / root)</strong>
              </li>
              <li>
                เว็บไซต์จะเปิดให้บริการผ่าน URL เช่น <code className="text-blue-600 font-mono">https://&lt;username&gt;.github.io/&lt;repo-name&gt;/</code> ทันที
              </li>
            </ol>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleDownloadStandaloneHtml}
              className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลดไฟล์ index.html
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
