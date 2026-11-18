import React, { useState, useEffect } from 'react';
import { ImageAsset, ImageAssetCategory } from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize } from '../utils/imageOptimizer';
import {
  Image as ImageIcon,
  X,
  Database,
  Cloud,
  Check,
  Trash2,
  Search,
  ExternalLink,
} from 'lucide-react';

interface FirebaseImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (asset: ImageAsset) => void;
  initialCategory?: ImageAssetCategory | 'all';
  title?: string;
  onNotify?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const CATEGORY_LABELS: Record<ImageAssetCategory, string> = {
  front_bg: 'พื้นหลังหน้าบัตร',
  back_bg: 'พื้นหลังหลังบัตร',
  guardian_photo: 'รูปผู้ปกครอง',
  sample_photo: 'รูปตัวอย่างบัตร',
};

export const FirebaseImagePickerModal: React.FC<FirebaseImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialCategory = 'all',
  title = 'คลังไฟล์รูปภาพบนฐานข้อมูล Firebase',
  onNotify,
}) => {
  const [assets, setAssets] = useState<ImageAsset[]>(() => storageService.getImageAssets());
  const [categoryFilter, setCategoryFilter] = useState<ImageAssetCategory | 'all'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fbStatus = storageService.getFirebaseStatus();

  useEffect(() => {
    if (isOpen) {
      setAssets(storageService.getImageAssets());
      setCategoryFilter(initialCategory);
      setConfirmDeleteId(null);
    }
  }, [isOpen, initialCategory]);

  useEffect(() => {
    return storageService.subscribe(() => {
      setAssets(storageService.getImageAssets());
    });
  }, []);

  if (!isOpen) return null;

  const filteredAssets = assets.filter((a) => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.fileName.toLowerCase().includes(q) ||
      CATEGORY_LABELS[a.category].toLowerCase().includes(q)
    );
  });

  const handleDeleteAsset = async (asset: ImageAsset) => {
    setDeletingId(asset.id);
    try {
      await storageService.deleteImageAsset(asset.id);
      setConfirmDeleteId(null);
      onNotify?.(`ลบรูปภาพ "${asset.fileName}" ออกจากฐานข้อมูล Firebase แล้ว`, 'info');
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'ไม่สามารถลบรูปภาพออกจาก Firebase ได้',
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
              <p className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                รูปภาพทั้งหมดถูกบีบอัดและจัดเก็บไว้ใน Firestore (image_assets) เพื่อเรียกใช้ซ้ำข้ามอุปกรณ์ได้ทันที
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://console.firebase.google.com/project/${fbStatus.projectId}/firestore/databases/${fbStatus.databaseId}/data/~2Fimage_assets`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <span>ดูใน Firebase Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {(
              [
                { key: 'all', label: `ทั้งหมด (${assets.length})` },
                {
                  key: 'front_bg',
                  label: `หน้าบัตร (${assets.filter((a) => a.category === 'front_bg').length})`,
                },
                {
                  key: 'back_bg',
                  label: `หลังบัตร (${assets.filter((a) => a.category === 'back_bg').length})`,
                },
                {
                  key: 'guardian_photo',
                  label: `รูปผู้ปกครอง (${assets.filter((a) => a.category === 'guardian_photo').length})`,
                },
                {
                  key: 'sample_photo',
                  label: `รูปตัวอย่าง (${assets.filter((a) => a.category === 'sample_photo').length})`,
                },
              ] as { key: ImageAssetCategory | 'all'; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  categoryFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อไฟล์รูปภาพ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
            />
          </div>
        </div>

        {/* Asset Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {filteredAssets.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-600">
                ยังไม่มีรูปภาพในหมวดหมู่นี้บนฐานข้อมูล Firebase
              </div>
              <p className="text-xs text-slate-400 font-sarabun">
                เมื่อคุณอัปโหลดภาพพื้นหลังบัตรหรือรูปถ่ายผู้ปกครอง ระบบจะบันทึกลงคอลเลกชัน image_assets ใน Firebase ให้อัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const imgSrc = asset.dataUrl || asset.storageUrl || '';
                const isConfirming = confirmDeleteId === asset.id;

                return (
                  <div
                    key={asset.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="bg-slate-100 h-36 flex items-center justify-center overflow-hidden relative p-2">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={asset.fileName}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xs"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-semibold">
                        {CATEGORY_LABELS[asset.category]}
                      </span>
                      <span
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-white/90 text-slate-700 text-[10px] font-mono border border-slate-200 flex items-center gap-1"
                        title={
                          asset.storageBackend === 'both'
                            ? 'จัดเก็บทั้ง Firestore DB และ Firebase Storage'
                            : asset.storageBackend === 'firestore'
                            ? 'จัดเก็บใน Firestore Database'
                            : 'จัดเก็บใน Firebase Storage'
                        }
                      >
                        {asset.storageBackend === 'both' ? (
                          <>
                            <Database className="w-2.5 h-2.5 text-blue-600" />
                            <Cloud className="w-2.5 h-2.5 text-emerald-600" />
                          </>
                        ) : asset.storageBackend === 'firestore' ? (
                          <Database className="w-2.5 h-2.5 text-blue-600" />
                        ) : (
                          <Cloud className="w-2.5 h-2.5 text-emerald-600" />
                        )}
                      </span>
                    </div>

                    <div className="p-3 space-y-2.5 text-xs">
                      <div>
                        <div className="font-bold text-slate-800 truncate" title={asset.fileName}>
                          {asset.fileName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {asset.width}×{asset.height} px • {formatFileSize(asset.compressedSize)}
                        </div>
                      </div>

                      {isConfirming ? (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-rose-800">
                            ยืนยันลบภาพ?
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-600 cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === asset.id}
                              onClick={() => handleDeleteAsset(asset)}
                              className="px-2 py-1 text-[10px] bg-rose-600 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {deletingId === asset.id ? 'กำลังลบ...' : 'ลบ'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          {onSelect ? (
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(asset);
                                onClose();
                              }}
                              className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>เลือกรูปนี้</span>
                            </button>
                          ) : (
                            <span className="flex-1 text-[11px] text-emerald-700 font-semibold font-sarabun">
                              บันทึกบน Firebase แล้ว
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(asset.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="ลบรูปภาพนี้ออกจาก Firebase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sarabun">
            แสดง {filteredAssets.length} จากทั้งหมด {assets.length} ไฟล์
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
