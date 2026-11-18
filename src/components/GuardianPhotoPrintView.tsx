import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Guardian,
  ImageAsset,
  ImageAssetReference,
  PhotoHorizontalAlign,
  PhotoMarginsMm,
  PhotoPrintLayout,
  PhotoVerticalAlign,
  PrintPreviewPayload,
} from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize } from '../utils/imageOptimizer';
import { openPrintPreviewInNewTab } from '../utils/printPreview';
import {
  DEFAULT_PHOTO_MARGINS_MM,
  PhotoPrintSheet,
  paginatePhotoPrintAssets,
} from './PhotoPrintSheet';
import {
  Printer,
  Trash2,
  Search,
  Check,
  AlertTriangle,
  ShieldCheck,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Columns3,
  Rows3,
  Upload,
  X,
  ExternalLink,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Loader2,
  HardDrive,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

interface GuardianPhotoPrintViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const ITEMS_PER_PAGE = 12;

function formatBytesDetailed(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(3)} GiB`;
}

export const GuardianPhotoPrintView: React.FC<GuardianPhotoPrintViewProps> = ({
  onNotify,
}) => {
  const [assets, setAssets] = useState<ImageAsset[]>(() => storageService.getImageAssets());
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [usageSummary, setUsageSummary] = useState(() =>
    storageService.getFirestoreUsageSummary()
  );

  // Filters & Pagination
  const [categoryFilter, setCategoryFilter] = useState<'guardian_photo' | 'all'>('guardian_photo');
  const [bindingFilter, setBindingFilter] = useState<'all' | 'bound' | 'unbound'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection for printing (preserves order)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Print Layout Settings
  const [layout, setLayout] = useState<PhotoPrintLayout>('horizontal');
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [gapMm, setGapMm] = useState<number>(4);
  const [horizontalAlign, setHorizontalAlign] = useState<PhotoHorizontalAlign>('center');
  const [verticalAlign, setVerticalAlign] = useState<PhotoVerticalAlign>('top');
  const [marginsMm, setMarginsMm] = useState<PhotoMarginsMm>(DEFAULT_PHOTO_MARGINS_MM);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [stripExtension, setStripExtension] = useState<boolean>(false);
  const [showGuardianName, setShowGuardianName] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [previewZoom, setPreviewZoom] = useState<number>(0.48);
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState<boolean>(false);
  const [blockedPreviewUrl, setBlockedPreviewUrl] = useState<string | null>(null);

  // Safe Delete State
  const [blockedDeleteTarget, setBlockedDeleteTarget] = useState<{
    asset: ImageAsset;
    refs: ImageAssetReference[];
  } | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<ImageAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Quick Upload Guardian Photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => {
      setAssets(storageService.getImageAssets());
      setGuardians(storageService.getGuardians());
      setUsageSummary(storageService.getFirestoreUsageSummary());
    };
    refresh();
    return storageService.subscribe(refresh);
  }, []);

  // Compute references map for every asset so badges & filters stay reactive
  const referencesByAssetId = useMemo(() => {
    const map = new Map<string, ImageAssetReference[]>();
    for (const asset of assets) {
      map.set(asset.id, storageService.getImageAssetReferences(asset));
    }
    return map;
  }, [assets, guardians]);

  // Clean up selectedIds if any selected asset was deleted externally
  useEffect(() => {
    const validIds = new Set(assets.map((a) => a.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [assets]);

  const categoryAssets = useMemo(() => {
    return categoryFilter === 'guardian_photo'
      ? assets.filter((a) => a.category === 'guardian_photo')
      : assets;
  }, [assets, categoryFilter]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryAssets.filter((asset) => {
      const refs = referencesByAssetId.get(asset.id) || [];
      if (bindingFilter === 'bound' && refs.length === 0) return false;
      if (bindingFilter === 'unbound' && refs.length > 0) return false;

      if (!q) return true;
      const inFileName = asset.fileName.toLowerCase().includes(q);
      const inRefs = refs.some(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.detail && r.detail.toLowerCase().includes(q))
      );
      return inFileName || inRefs;
    });
  }, [categoryAssets, bindingFilter, searchQuery, referencesByAssetId]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, bindingFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAssets = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredAssets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssets, safePage]);

  const unboundStats = useMemo(() => {
    let count = 0;
    let bytes = 0;
    for (const a of assets) {
      const refs = referencesByAssetId.get(a.id) || [];
      if (refs.length === 0) {
        count++;
        bytes += a.dataUrl ? a.dataUrl.length : a.compressedSize || 0;
      }
    }
    return { count, bytes };
  }, [assets, referencesByAssetId]);

  const selectedAssets = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    return selectedIds
      .map((id) => assetMap.get(id))
      .filter((a): a is ImageAsset => Boolean(a));
  }, [assets, selectedIds]);

  const effectiveGapMm = Math.max(0.5, Number.isFinite(gapMm) ? gapMm : 0.5);

  const previewPages = useMemo(
    () =>
      paginatePhotoPrintAssets(
        selectedAssets,
        layout,
        paperOrientation,
        effectiveGapMm,
        showGuardianName,
        marginsMm
      ),
    [selectedAssets, layout, paperOrientation, effectiveGapMm, showGuardianName, marginsMm]
  );

  const handleMarginChange = (side: keyof PhotoMarginsMm, rawValue: string) => {
    const num = Number(rawValue);
    const clamped = Number.isFinite(num) ? Math.max(0, Math.min(80, num)) : 0;
    setMarginsMm((prev) => ({ ...prev, [side]: clamped }));
  };

  const applyUniformMargins = (mm: number) => {
    setMarginsMm({ top: mm, right: mm, bottom: mm, left: mm });
  };

  const handleSelectLayout = (nextLayout: PhotoPrintLayout) => {
    setLayout(nextLayout);
    // Smart default orientation per layout (user can still override manually)
    if (nextLayout === 'vertical') {
      setPaperOrientation('portrait');
    } else {
      setPaperOrientation('landscape');
    }
  };

  const toggleSelectAsset = (assetId: string) => {
    setSelectedIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredAssets.map((a) => a.id);
    setSelectedIds((prev) => {
      const merged = new Set(prev);
      filteredIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const moveSelectedItem = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
  };

  const handleRequestDeleteAsset = (asset: ImageAsset) => {
    // Re-evaluate fresh references right at delete time
    const freshRefs = storageService.getImageAssetReferences(asset);
    if (freshRefs.length > 0) {
      setBlockedDeleteTarget({ asset, refs: freshRefs });
      onNotify(
        `ไม่สามารถลบรูป "${asset.fileName}" ได้ เนื่องจากถูกผูกกับข้อมูลอยู่ ${freshRefs.length} รายการ`,
        'error'
      );
      return;
    }
    setConfirmDeleteTarget(asset);
  };

  const handleConfirmDeleteAsset = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;

    // Double-check before executing actual deletion
    const freshRefs = storageService.getImageAssetReferences(target);
    if (freshRefs.length > 0) {
      setConfirmDeleteTarget(null);
      setBlockedDeleteTarget({ asset: target, refs: freshRefs });
      onNotify(
        `ไม่สามารถลบรูป "${target.fileName}" ได้ เนื่องจากถูกผูกกับข้อมูลในระบบ`,
        'error'
      );
      return;
    }

    setIsDeleting(true);
    try {
      await storageService.deleteImageAsset(target.id);
      setSelectedIds((prev) => prev.filter((id) => id !== target.id));
      setConfirmDeleteTarget(null);
      setUsageSummary(storageService.getFirestoreUsageSummary());
      onNotify(`ลบรูปภาพ "${target.fileName}" ออกจากระบบเรียบร้อยแล้ว`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถลบรูปภาพออกจาก Firebase ได้',
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadNewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    let uploadedCount = 0;
    const newlyUploadedIds: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const summary = await storageService.uploadGuardianPhoto(file, file.name);
        uploadedCount++;
        newlyUploadedIds.push(summary.photoAssetId);
      }
      if (uploadedCount > 0) {
        setSelectedIds((prev) => [...prev, ...newlyUploadedIds]);
        setUsageSummary(storageService.getFirestoreUsageSummary());
        onNotify(`อัปโหลดรูปผู้ปกครองสำเร็จ ${uploadedCount} รูป และเลือกพร้อมพิมพ์แล้ว`, 'success');
      } else {
        onNotify('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง', 'error');
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'อัปโหลดรูปภาพไม่สำเร็จ',
        'error'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenPrintPreviewTab = () => {
    if (selectedAssets.length === 0) {
      onNotify('กรุณาเลือกรูปผู้ปกครองอย่างน้อย 1 รูปก่อนสั่งพิมพ์', 'error');
      return;
    }

    const currentUser = storageService.getCurrentUser();
    const payload: PrintPreviewPayload = {
      id: `prev_photo_${Date.now()}`,
      createdAt: new Date().toISOString(),
      side: 'photo',
      trayConfig: storageService.getTrayConfig(),
      enableSlot1: false,
      enableSlot2: false,
      photoPrintConfig: {
        layout,
        paperOrientation,
        gapMm: effectiveGapMm,
        horizontalAlign,
        verticalAlign,
        marginsMm,
        showCutLines,
        stripExtension,
        showGuardianName,
        fitMode,
        assetIds: selectedAssets.map((a) => a.id),
      },
      operatorName: currentUser?.fullName || 'เจ้าหน้าที่ผู้พิมพ์',
    };

    const result = openPrintPreviewInNewTab(payload);
    if (result.opened) {
      setBlockedPreviewUrl(null);
      onNotify('เปิดหน้าตัวอย่างการพิมพ์ในแท็บใหม่เรียบร้อยแล้ว', 'success');
    } else {
      setBlockedPreviewUrl(result.url);
      onNotify('เบราว์เซอร์บล็อกป๊อปอัป กรุณากดลิงก์เปิดแท็บตัวอย่างด้านล่าง หรือดูตัวอย่างเต็มจอ', 'info');
    }
  };

  const quotaPct = usageSummary.usedPercentage;
  const barColor =
    quotaPct >= 90 ? 'bg-rose-600' : quotaPct >= 70 ? 'bg-amber-500' : 'bg-emerald-600';

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  return (
    <div className="space-y-6">
      {/* Header & Firestore Free Quota Overview */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600 shrink-0" />
              <span>พิมพ์รูปผู้ปกครอง (30 × 40 มม.)</span>
            </h2>
            <p className="text-xs text-slate-500 font-sarabun mt-1.5 leading-relaxed">
              เลือกรูปผู้ปกครองเพื่อจัดพิมพ์ขนาดจริง <strong>กว้าง 30 มม. × สูง 40 มม.</strong> พร้อมชื่อรูป
              รองรับการจัดวาง <strong>1 แถวแนวตั้ง</strong> และ <strong>1 แถวนอน</strong> และลบรูปที่ไม่ได้ผูกข้อมูลได้ปลอดภัย
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadNewPhoto}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปผู้ปกครองเพิ่ม'}</span>
            </button>

            <span className="text-[11px] text-slate-500 font-sarabun">
              เลือกพิมพ์แล้ว <strong className="text-blue-700 font-mono">{selectedAssets.length}</strong> รูป
            </span>
          </div>
        </div>

        {/* Firestore Free Tier Storage Quota Card */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>พื้นที่จัดเก็บ Firestore (โควตาบริการฟรี 1 GiB)</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Spark Free Plan
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                  คำนวณปริมาณพื้นที่โดยรวมทั้งหมดบน Firestore ({usageSummary.totalDocuments.toLocaleString()} เอกสาร)
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold font-mono text-slate-900">
                {formatBytesDetailed(usageSummary.totalUsedBytes)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 1.00 GiB (1,024 MB)</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                ใช้งาน {quotaPct < 0.01 && usageSummary.totalUsedBytes > 0 ? '< 0.01' : quotaPct.toFixed(2)}% • คงเหลือ{' '}
                {formatBytesDetailed(usageSummary.remainingBytes)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
            <div
              className={`h-full ${barColor} transition-all duration-300`}
              style={{
                width: `${usageSummary.totalUsedBytes > 0 ? Math.max(0.8, Math.min(100, quotaPct)) : 0}%`,
              }}
            />
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {usageSummary.breakdown.map((item) => (
              <div
                key={item.key}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-left"
              >
                <div className="text-[10px] text-slate-500 font-sarabun truncate" title={item.label}>
                  {item.label}
                </div>
                <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                  {formatBytesDetailed(item.bytes)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {item.count} รายการ
                </div>
              </div>
            ))}
          </div>

          {unboundStats.count > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 font-sarabun">
              <span>
                พบรูปภาพที่ไม่ได้ผูกกับข้อมูลใดๆ จำนวน <strong>{unboundStats.count}</strong> ไฟล์ (สามารถลบออกเพื่อคืนพื้นที่ได้ประมาณ{' '}
                <strong className="font-mono">{formatBytesDetailed(unboundStats.bytes)}</strong>)
              </span>
              <button
                type="button"
                onClick={() => setBindingFilter('unbound')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300 shrink-0 cursor-pointer transition-colors"
              >
                กรองดูรูปที่ลบได้
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Photo Library, Selection & Safe Delete */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('guardian_photo')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'guardian_photo'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  รูปผู้ปกครอง ({assets.filter((a) => a.category === 'guardian_photo').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  รูปทั้งหมดในระบบ ({assets.length})
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  disabled={filteredAssets.length === 0}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>เลือกทั้งหมด</span>
                </button>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 font-semibold cursor-pointer"
                  >
                    ล้างที่เลือก ({selectedIds.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อรูป หรือชื่อผู้ปกครอง/แม่แบบที่ผูกไว้..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                {(
                  [
                    { key: 'all', label: 'ทั้งหมด' },
                    { key: 'bound', label: 'ผูกข้อมูล' },
                    { key: 'unbound', label: 'ไม่ได้ผูก' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setBindingFilter(item.key)}
                    className={`px-2.5 py-1.5 rounded-xl font-semibold border transition-colors cursor-pointer ${
                      bindingFilter === item.key
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Photo Cards Grid */}
          <div className="p-4">
            {paginatedAssets.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-600">
                  ไม่พบรูปภาพตามเงื่อนไขที่เลือก
                </div>
                <p className="text-xs text-slate-400 font-sarabun">
                  อัปโหลดรูปผู้ปกครองในหน้าทะเบียนบัตร หรือกดปุ่มอัปโหลดรูปด้านบนเพื่อเริ่มพิมพ์
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {paginatedAssets.map((asset) => {
                  const isSelected = selectedIds.includes(asset.id);
                  const selectionOrder = selectedIds.indexOf(asset.id) + 1;
                  const refs = referencesByAssetId.get(asset.id) || [];
                  const isBound = refs.length > 0;
                  const imgSrc =
                    asset.dataUrl ||
                    asset.storageUrl ||
                    storageService.resolveImageSrc(`firestore-asset://${asset.id}`, asset.id);

                  return (
                    <div
                      key={asset.id}
                      className={`group rounded-2xl border transition-all overflow-hidden flex flex-col justify-between bg-white ${
                        isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      {/* Thumbnail & Select Trigger */}
                      <div
                        onClick={() => toggleSelectAsset(asset.id)}
                        className="relative bg-slate-100 h-32 flex items-center justify-center overflow-hidden cursor-pointer p-2"
                      >
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={asset.fileName}
                            className="max-w-full max-h-full object-contain rounded-lg"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}

                        {/* Selection Checkbox */}
                        <div className="absolute top-2 left-2">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold shadow-xs">
                              <Check className="w-3 h-3" />
                              #{selectionOrder}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/90 border border-slate-300 text-slate-400 group-hover:text-blue-600 shadow-2xs">
                              <Square className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        {/* Binding Status Badge */}
                        <div className="absolute bottom-2 left-2 right-2 flex justify-start">
                          {isBound ? (
                            <span
                              className="px-1.5 py-0.5 rounded-md bg-amber-100/95 text-amber-900 border border-amber-300 text-[10px] font-semibold truncate max-w-full"
                              title={refs.map((r) => `${r.label} (${r.detail || ''})`).join('\n')}
                            >
                              ผูกข้อมูล ({refs.length})
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100/95 text-emerald-800 border border-emerald-300 text-[10px] font-semibold">
                              ไม่ได้ผูกข้อมูล
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta & Actions */}
                      <div className="p-2.5 space-y-2 text-xs border-t border-slate-100">
                        <div>
                          <div
                            className="font-bold text-slate-800 truncate text-[11px]"
                            title={asset.fileName}
                          >
                            {asset.fileName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {asset.width}×{asset.height} • {formatFileSize(asset.compressedSize)}
                          </div>
                          {isBound && (
                            <div
                              className="text-[10px] text-slate-600 font-sarabun truncate mt-0.5"
                              title={refs.map((r) => r.label).join(', ')}
                            >
                              {refs[0].label}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleSelectAsset(asset.id)}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isSelected ? 'ยกเลิกเลือก' : 'เลือกพิมพ์'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDeleteAsset(asset)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isBound
                                ? 'text-amber-600 border-amber-200 bg-amber-50/70 hover:bg-amber-100'
                                : 'text-rose-600 border-rose-200 bg-rose-50/70 hover:bg-rose-100'
                            }`}
                            title={
                              isBound
                                ? 'รูปนี้ถูกผูกข้อมูลอยู่ (คลิกเพื่อดูรายละเอียด)'
                                : 'ลบรูปภาพนี้ออกจากระบบ'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Numbered Pagination */}
          {filteredAssets.length > ITEMS_PER_PAGE && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-[11px] text-slate-500 font-sarabun">
                หน้า <strong className="font-mono text-slate-700">{safePage}</strong> /{' '}
                <strong className="font-mono text-slate-700">{totalPages}</strong> (ทั้งหมด{' '}
                {filteredAssets.length} รูป)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCurrentPage(num)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      num === safePage
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Print Settings & Live Print Preview */}
        <div className="lg:col-span-6 space-y-4">
          {/* Print Options Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  ตั้งค่าการพิมพ์และรูปแบบแถว
                </h3>
                <p className="text-[11px] text-slate-500 font-sarabun">
                  ขนาดภาพพิมพ์จริง: กว้าง <strong>30 มม.</strong> × สูง <strong>40 มม.</strong> พร้อมชื่อรูป
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedAssets.length === 0}
                  onClick={() => setIsFullscreenPreviewOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>ขยายตัวอย่าง</span>
                </button>
                <button
                  type="button"
                  disabled={selectedAssets.length === 0}
                  onClick={handleOpenPrintPreviewTab}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>หน้าตัวอย่าง / สั่งพิมพ์ ({selectedAssets.length})</span>
                </button>
              </div>
            </div>

            {blockedPreviewUrl && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                <span className="text-amber-900 font-sarabun">
                  เบราว์เซอร์บล็อกการเปิดแท็บใหม่อัตโนมัติ กดปุ่มขวาเพื่อเปิดหน้าตัวอย่างการพิมพ์:
                </span>
                <a
                  href={blockedPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg flex items-center gap-1 shrink-0"
                >
                  <span>เปิดแท็บพิมพ์</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Layout Mode, Orientation & Gap (>= 0.5mm) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  เลือกรูปแบบการจัดเรียง
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectLayout('vertical')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      layout === 'vertical'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Rows3 className="w-4 h-4" />
                    <span>1 แถวแนวตั้ง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLayout('horizontal')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      layout === 'horizontal'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Columns3 className="w-4 h-4" />
                    <span>1 แถวนอน</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  แนวกระดาษ (A4)
                </label>
                <select
                  value={paperOrientation}
                  onChange={(e) =>
                    setPaperOrientation(e.target.value as 'portrait' | 'landscape')
                  }
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="portrait">A4 แนวตั้ง (210×297 มม.)</option>
                  <option value="landscape">A4 แนวนอน (297×210 มม.)</option>
                </select>
              </div>
            </div>

            {/* Alignment Controls (Left / Right / Top / Bottom) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  การจัดชิดแนวนอน (ซ้าย / กลาง / ขวา)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { key: 'left', label: 'ชิดซ้าย', Icon: AlignLeft },
                      { key: 'center', label: 'กึ่งกลาง', Icon: AlignCenter },
                      { key: 'right', label: 'ชิดขวา', Icon: AlignRight },
                    ] as const
                  ).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHorizontalAlign(key)}
                      className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        horizontalAlign === key
                          ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  การจัดชิดแนวตั้ง (บน / กลาง / ล่าง)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { key: 'top', label: 'ชิดบน' },
                      { key: 'center', label: 'กึ่งกลาง' },
                      { key: 'bottom', label: 'ชิดล่าง' },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setVerticalAlign(key)}
                      className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        verticalAlign === key
                          ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gap (>= 0.5mm) & Paper Margins */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1 border-t border-slate-100">
              <div className="sm:col-span-5 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  ระยะห่างระหว่างรูป (ขั้นต่ำ 0.5 มม.)
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0.5}
                      max={30}
                      step={0.5}
                      value={gapMm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setGapMm(Number.isFinite(val) ? val : 0.5);
                      }}
                      onBlur={() => setGapMm((prev) => Math.max(0.5, Math.min(30, prev || 0.5)))}
                      className="w-full pl-2.5 pr-9 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sarabun">
                      มม.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {[0.5, 1, 2, 4, 6].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGapMm(preset)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        effectiveGapMm === preset
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-7 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    ระยะขอบกระดาษ (มม.)
                  </label>
                  <div className="flex items-center gap-1">
                    {[0, 5, 10, 15].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyUniformMargins(preset)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                        title={`ตั้งขอบกระดาษทุกด้านเป็น ${preset} มม.`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { key: 'top', label: 'บน' },
                      { key: 'bottom', label: 'ล่าง' },
                      { key: 'left', label: 'ซ้าย' },
                      { key: 'right', label: 'ขวา' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="space-y-0.5">
                      <span className="block text-[10px] text-slate-500 font-sarabun text-center">
                        ขอบ{label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        step={0.5}
                        value={marginsMm[key]}
                        onChange={(e) => handleMarginChange(key, e.target.value)}
                        className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Extra Formatting Options */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-[11px] text-slate-700 font-sarabun">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCutLines}
                  onChange={(e) => setShowCutLines(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>เส้นประตัดขอบ 30×40 มม.</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripExtension}
                  onChange={(e) => setStripExtension(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>ซ่อนนามสกุลไฟล์</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGuardianName}
                  onChange={(e) => setShowGuardianName(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>แสดงชื่อผู้ปกครองกำกับ (ถ้าผูกไว้)</span>
              </label>
              <select
                value={fitMode}
                onChange={(e) => setFitMode(e.target.value as 'cover' | 'contain')}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700"
              >
                <option value="cover">ครอบภาพเต็มกรอบ (Cover)</option>
                <option value="contain">ภาพเต็มใบไม่ตัดขอบ (Contain)</option>
              </select>
            </div>

            {/* Selected Order Chips */}
            {selectedAssets.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-600">
                  ลำดับรูปที่จะพิมพ์ ({selectedAssets.length} รูป • จัดวาง {previewPages.length} แผ่น):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {selectedAssets.map((asset, idx) => (
                    <div
                      key={asset.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900"
                    >
                      <span className="font-mono font-bold text-blue-700">#{idx + 1}</span>
                      <span className="truncate max-w-[120px] font-sarabun">{asset.fileName}</span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSelectedItem(idx, -1)}
                        className="p-0.5 text-slate-500 hover:text-blue-700 disabled:opacity-30 cursor-pointer"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedAssets.length - 1}
                        onClick={() => moveSelectedItem(idx, 1)}
                        className="p-0.5 text-slate-500 hover:text-blue-700 disabled:opacity-30 cursor-pointer"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSelectAsset(asset.id)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="เอาออก"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Embedded Live Print Preview */}
          <div className="bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>หน้าตัวอย่างการพิมพ์ (Print Preview)</span>
                {previewPages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                    {previewPages.length} แผ่น A4
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))
                  }
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded cursor-pointer"
                  title="ย่อตัวอย่าง"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] font-bold text-slate-700">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((z) => Math.min(1.0, Number((z + 0.1).toFixed(2))))
                  }
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded cursor-pointer"
                  title="ขยายตัวอย่าง"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[560px] flex justify-center">
              {selectedAssets.length === 0 ? (
                <div className="py-16 text-center space-y-2 max-w-xs">
                  <Printer className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-xs font-bold text-slate-600">
                    ยังไม่ได้เลือกรูปสำหรับแสดงตัวอย่างการพิมพ์
                  </div>
                  <p className="text-[11px] text-slate-400 font-sarabun">
                    คลิกเลือกรูปผู้ปกครองจากรายการด้านซ้ายเพื่อดูตัวอย่างการจัดวางขนาด 30 × 40 มม. แบบ{' '}
                    {layout === 'vertical' ? '1 แถวแนวตั้ง' : '1 แถวนอน'}
                  </p>
                </div>
              ) : (
                <PhotoPrintSheet
                  assets={selectedAssets}
                  layout={layout}
                  paperOrientation={paperOrientation}
                  gapMm={effectiveGapMm}
                  horizontalAlign={horizontalAlign}
                  verticalAlign={verticalAlign}
                  marginsMm={marginsMm}
                  showCutLines={showCutLines}
                  stripExtension={stripExtension}
                  showGuardianName={showGuardianName}
                  fitMode={fitMode}
                  guardians={guardians}
                  zoom={previewZoom}
                  isPrintMode={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Print Preview Modal */}
      {isFullscreenPreviewOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex flex-col">
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                หน้าตัวอย่างการพิมพ์รูปผู้ปกครอง — ขนาด 30 × 40 มม. ({layout === 'vertical' ? '1 แถวแนวตั้ง' : '1 แถวนอน'})
              </h3>
              <p className="text-[11px] text-slate-500 font-sarabun">
                จำนวน {selectedAssets.length} รูป • {previewPages.length} แผ่น A4{' '}
                {paperOrientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPrintPreviewTab}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>เปิดแท็บสั่งพิมพ์จริง (Print)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenPreviewOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <PhotoPrintSheet
              assets={selectedAssets}
              layout={layout}
              paperOrientation={paperOrientation}
              gapMm={effectiveGapMm}
              horizontalAlign={horizontalAlign}
              verticalAlign={verticalAlign}
              marginsMm={marginsMm}
              showCutLines={showCutLines}
              stripExtension={stripExtension}
              showGuardianName={showGuardianName}
              fitMode={fitMode}
              guardians={guardians}
              zoom={0.85}
              isPrintMode={false}
            />
          </div>
        </div>
      )}

      {/* Blocked Delete Warning Modal (Image is bound to existing records) */}
      {blockedDeleteTarget && (
        <div className="no-print fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-amber-950">
                  ไม่สามารถลบรูปภาพออกจากระบบได้
                </h3>
                <p className="text-xs text-amber-800 font-sarabun mt-0.5">
                  รูปภาพ <strong className="font-mono break-all">{blockedDeleteTarget.asset.fileName}</strong>{' '}
                  ยังถูกผูกกับข้อมูลในระบบอยู่
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBlockedDeleteTarget(null)}
                className="text-amber-700 hover:text-amber-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="font-bold text-slate-700">
                รายการที่กำลังใช้งานรูปนี้อยู่ ({blockedDeleteTarget.refs.length} รายการ):
              </div>
              <div className="max-h-52 overflow-y-auto space-y-2">
                {blockedDeleteTarget.refs.map((ref, idx) => (
                  <div
                    key={`${ref.type}_${ref.id}_${idx}`}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="font-bold text-slate-800">{ref.label}</div>
                    {ref.detail && (
                      <div className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                        {ref.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-sarabun leading-relaxed bg-blue-50/70 border border-blue-100 p-2.5 rounded-xl">
                หากต้องการลบรูปภาพนี้ กรุณาไปเปลี่ยนรูปหรือลบข้อมูลผู้ปกครอง/แม่แบบที่ผูกอยู่ออกก่อน เพื่อป้องกันบัตรรับส่งแสดงผลภาพหาย
              </p>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl cursor-pointer"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal (Only shown when asset has ZERO references) */}
      {confirmDeleteTarget && (
        <div className="no-print fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  ยืนยันการลบรูปภาพถาวร
                </h3>
                <p className="text-xs text-emerald-700 font-sarabun mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>ตรวจสอบแล้ว: ไม่ได้ผูกกับข้อมูลใดๆ</span>
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <img
                  src={
                    confirmDeleteTarget.dataUrl ||
                    confirmDeleteTarget.storageUrl ||
                    ''
                  }
                  alt={confirmDeleteTarget.fileName}
                  className="w-12 h-16 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">
                    {confirmDeleteTarget.fileName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {confirmDeleteTarget.width}×{confirmDeleteTarget.height} px •{' '}
                    {formatFileSize(confirmDeleteTarget.compressedSize)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-sarabun mt-0.5">
                    คืนพื้นที่ Firestore ประมาณ{' '}
                    {formatBytesDetailed(
                      confirmDeleteTarget.dataUrl
                        ? confirmDeleteTarget.dataUrl.length
                        : confirmDeleteTarget.compressedSize
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-sarabun">
                รูปภาพจะถูกลบออกจากฐานข้อมูล Firebase Firestore และ Storage ทันที ไม่สามารถกู้คืนได้
              </p>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteAsset}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบรูปภาพ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
