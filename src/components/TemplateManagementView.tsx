import React, { useState, useEffect } from 'react';
import {
  CardDesignConfig,
  BackCardDesignConfig,
  EducationLevel,
} from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize } from '../utils/imageOptimizer';
import {
  DEFAULT_JUNIOR_DESIGN,
  DEFAULT_SENIOR_DESIGN,
  DEFAULT_BACK_CARD_DESIGN,
} from '../utils/defaultData';
import { CardPreview } from './CardPreview';
import { BackCardPreview } from './BackCardPreview';
import { FirebaseImagePickerModal } from './FirebaseImagePickerModal';
import {
  Layers,
  Search,
  Plus,
  Pencil,
  Sliders,
  Copy,
  Trash2,
  Star,
  Check,
  CreditCard,
  FlipHorizontal2,
  X,
  Save,
  Upload,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface TemplateManagementViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onEditInDesigner: (side: 'front' | 'back', templateId: string) => void;
}

type FilterSide = 'all' | 'front' | 'back';

export const TemplateManagementView: React.FC<TemplateManagementViewProps> = ({
  onNotify,
  onEditInDesigner,
}) => {
  const [frontDesigns, setFrontDesigns] = useState<CardDesignConfig[]>(() =>
    storageService.getFrontDesigns()
  );
  const [backDesigns, setBackDesigns] = useState<BackCardDesignConfig[]>(() =>
    storageService.getBackDesigns()
  );
  const [isUploadingBg, setIsUploadingBg] = useState<boolean>(false);

  useEffect(() => {
    return storageService.subscribe(() => {
      setFrontDesigns(storageService.getFrontDesigns());
      setBackDesigns(storageService.getBackDesigns());
    });
  }, []);

  const [filterSide, setFilterSide] = useState<FilterSide>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick Edit Front Modal
  const [editingFront, setEditingFront] = useState<CardDesignConfig | null>(null);
  // Quick Edit Back Modal
  const [editingBack, setEditingBack] = useState<BackCardDesignConfig | null>(null);
  const [imagePickerSide, setImagePickerSide] = useState<null | 'front' | 'back'>(null);

  // Create New Template Modal
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    side: 'front' | 'back';
    name: string;
    level: EducationLevel;
    displayMode: 'template' | 'imageOnly';
  }>({
    open: false,
    side: 'front',
    name: '',
    level: 'มัธยมศึกษาตอนต้น',
    displayMode: 'template',
  });

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    side: 'front' | 'back';
    id: string;
    name: string;
    isDefault?: boolean;
  } | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFronts = frontDesigns.filter((tpl) => {
    if (!normalizedQuery) return true;
    return (
      (tpl.name || '').toLowerCase().includes(normalizedQuery) ||
      (tpl.title || '').toLowerCase().includes(normalizedQuery) ||
      (tpl.subtitle || '').toLowerCase().includes(normalizedQuery) ||
      tpl.level.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredBacks = backDesigns.filter((tpl) => {
    if (!normalizedQuery) return true;
    return (
      (tpl.name || '').toLowerCase().includes(normalizedQuery) ||
      (tpl.title || '').toLowerCase().includes(normalizedQuery) ||
      (tpl.subtitle || '').toLowerCase().includes(normalizedQuery)
    );
  });

  // --- FRONT ACTIONS ---
  const handleSetDefaultFront = (id: string) => {
    const updated = storageService.setDefaultFrontDesign(id);
    setFrontDesigns(updated);
    const target = updated.find((d) => d.id === id);
    onNotify(
      `ตั้งแม่แบบหน้าบัตร "${target?.name || target?.title}" เป็นค่าเริ่มต้นสำหรับ ${target?.level} แล้ว`,
      'success'
    );
  };

  const handleDuplicateFront = (tpl: CardDesignConfig) => {
    const copy: CardDesignConfig = {
      ...JSON.parse(JSON.stringify(tpl)),
      id: `design_front_${Date.now()}`,
      name: `${tpl.name || tpl.title} (สำเนา)`,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveFrontDesign(copy);
    setFrontDesigns(updated);
    onNotify(`คัดลอกสร้างแม่แบบหน้าบัตร "${copy.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleSaveQuickFront = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFront) return;
    if (!editingFront.name?.trim()) {
      onNotify('กรุณากรอกชื่อแม่แบบหน้าบัตร', 'error');
      return;
    }
    const updated = storageService.saveFrontDesign({
      ...editingFront,
      name: editingFront.name.trim(),
    });
    setFrontDesigns(updated);
    setEditingFront(null);
    onNotify(`บันทึกการแก้ไขแม่แบบหน้าบัตร "${editingFront.name.trim()}" เรียบร้อยแล้ว`, 'success');
  };

  const handleUploadFrontBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFront) return;
    e.target.value = '';
    setIsUploadingBg(true);
    try {
      const uploaded = await storageService.uploadCardDesignImage(file, 'front', editingFront.id);
      setEditingFront((prev) =>
        prev
          ? {
              ...prev,
              bgImageUrl: uploaded.url,
              bgImageStoragePath: uploaded.storagePath,
              bgImageAssetId: uploaded.assetId,
              bgType: 'custom',
            }
          : prev
      );
      onNotify(
        `บีบอัดและบันทึกภาพพื้นหลังหน้าบัตรลง Firebase สำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)})`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        'error'
      );
    } finally {
      setIsUploadingBg(false);
    }
  };

  // --- BACK ACTIONS ---
  const handleSetDefaultBack = (id: string) => {
    const updated = storageService.setDefaultBackDesign(id);
    setBackDesigns(updated);
    const target = updated.find((d) => d.id === id);
    onNotify(
      `ตั้งแม่แบบหลังบัตร "${target?.name || target?.title}" เป็นค่าเริ่มต้นแล้ว`,
      'success'
    );
  };

  const handleDuplicateBack = (tpl: BackCardDesignConfig) => {
    const copy: BackCardDesignConfig = {
      ...JSON.parse(JSON.stringify(tpl)),
      id: `design_back_${Date.now()}`,
      name: `${tpl.name || tpl.title} (สำเนา)`,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveBackDesign(copy);
    setBackDesigns(updated);
    onNotify(`คัดลอกสร้างแม่แบบหลังบัตร "${copy.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleSaveQuickBack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBack) return;
    if (!editingBack.name?.trim()) {
      onNotify('กรุณากรอกชื่อแม่แบบหลังบัตร', 'error');
      return;
    }
    const updated = storageService.saveBackDesign({
      ...editingBack,
      name: editingBack.name.trim(),
    });
    setBackDesigns(updated);
    setEditingBack(null);
    onNotify(`บันทึกการแก้ไขแม่แบบหลังบัตร "${editingBack.name.trim()}" เรียบร้อยแล้ว`, 'success');
  };

  const handleUploadBackBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBack) return;
    e.target.value = '';
    setIsUploadingBg(true);
    try {
      const uploaded = await storageService.uploadCardDesignImage(file, 'back', editingBack.id);
      setEditingBack((prev) =>
        prev
          ? {
              ...prev,
              bgImageUrl: uploaded.url,
              bgImageStoragePath: uploaded.storagePath,
              bgImageAssetId: uploaded.assetId,
            }
          : prev
      );
      onNotify(
        `บีบอัดและบันทึกภาพพื้นหลังหลังบัตรลง Firebase สำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)})`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        'error'
      );
    } finally {
      setIsUploadingBg(false);
    }
  };

  // --- DELETE ---
  const requestDeleteFront = (tpl: CardDesignConfig) => {
    if (frontDesigns.length <= 1) {
      onNotify('ต้องมีแม่แบบหน้าบัตรอย่างน้อย 1 รูปแบบในระบบ', 'error');
      return;
    }
    setDeleteTarget({
      side: 'front',
      id: tpl.id,
      name: tpl.name || tpl.title,
      isDefault: tpl.isDefault,
    });
  };

  const requestDeleteBack = (tpl: BackCardDesignConfig) => {
    if (backDesigns.length <= 1) {
      onNotify('ต้องมีแม่แบบหลังบัตรอย่างน้อย 1 รูปแบบในระบบ', 'error');
      return;
    }
    setDeleteTarget({
      side: 'back',
      id: tpl.id,
      name: tpl.name || tpl.title,
      isDefault: tpl.isDefault,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.side === 'front') {
      const remaining = storageService.deleteFrontDesign(deleteTarget.id);
      setFrontDesigns(remaining);
      onNotify(`ลบแม่แบบหน้าบัตร "${deleteTarget.name}" เรียบร้อยแล้ว`, 'info');
    } else {
      const remaining = storageService.deleteBackDesign(deleteTarget.id);
      setBackDesigns(remaining);
      onNotify(`ลบแม่แบบหลังบัตร "${deleteTarget.name}" เรียบร้อยแล้ว`, 'info');
    }
    setDeleteTarget(null);
  };

  // --- CREATE NEW ---
  const openCreateModal = (side: 'front' | 'back') => {
    setCreateModal({
      open: true,
      side,
      name:
        side === 'front'
          ? `แม่แบบหน้าบัตรใหม่ ${frontDesigns.length + 1}`
          : `แม่แบบหลังบัตรใหม่ ${backDesigns.length + 1}`,
      level: 'มัธยมศึกษาตอนต้น',
      displayMode: 'template',
    });
  };

  const handleCreateTemplate = (openInDesigner: boolean) => {
    const trimmed = createModal.name.trim();
    if (!trimmed) {
      onNotify('กรุณากรอกชื่อแม่แบบใหม่', 'error');
      return;
    }

    if (createModal.side === 'front') {
      const base =
        createModal.level === 'มัธยมศึกษาตอนต้น'
          ? DEFAULT_JUNIOR_DESIGN
          : DEFAULT_SENIOR_DESIGN;
      const created: CardDesignConfig = {
        ...JSON.parse(JSON.stringify(base)),
        id: `design_front_${Date.now()}`,
        name: trimmed,
        level: createModal.level,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      };
      const updated = storageService.saveFrontDesign(created);
      setFrontDesigns(updated);
      setCreateModal((m) => ({ ...m, open: false }));
      onNotify(`สร้างแม่แบบหน้าบัตร "${trimmed}" เรียบร้อยแล้ว`, 'success');
      if (openInDesigner) {
        onEditInDesigner('front', created.id);
      }
    } else {
      const created: BackCardDesignConfig = {
        ...JSON.parse(JSON.stringify(DEFAULT_BACK_CARD_DESIGN)),
        id: `design_back_${Date.now()}`,
        name: trimmed,
        displayMode: createModal.displayMode,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      };
      const updated = storageService.saveBackDesign(created);
      setBackDesigns(updated);
      setCreateModal((m) => ({ ...m, open: false }));
      onNotify(`สร้างแม่แบบหลังบัตร "${trimmed}" เรียบร้อยแล้ว`, 'success');
      if (openInDesigner) {
        onEditInDesigner('back', created.id);
      }
    }
  };

  const formatUpdatedDate = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString('th-TH', {
        year: '2-digit',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            จัดการแม่แบบหน้าบัตรและหลังบัตร (Template Manager)
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-sarabun">
            ดูรายการแม่แบบทั้งหมด แก้ไขชื่อ/รายละเอียด เปิดแก้ไขดีไซน์ ตั้งค่าเริ่มต้น ทำสำเนา หรือลบแม่แบบที่ไม่ใช้งานทั้งหน้าบัตรและหลังบัตร
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openCreateModal('front')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างแม่แบบหน้าบัตร
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('back')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างแม่แบบหลังบัตร
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterSide('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filterSide === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({frontDesigns.length + backDesigns.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSide('front')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              filterSide === 'front'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            หน้าบัตร ({frontDesigns.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSide('back')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              filterSide === 'back'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
            หลังบัตร ({backDesigns.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อแม่แบบ, หัวข้อบัตร..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: FRONT CARD TEMPLATES */}
      {(filterSide === 'all' || filterSide === 'front') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </span>
              แม่แบบหน้าบัตร ({filteredFronts.length} รูปแบบ)
            </h3>
            <span className="text-[11px] text-slate-500 font-sarabun">
              * ระบบต้องมีแม่แบบหน้าบัตรอย่างน้อย 1 รูปแบบ
            </span>
          </div>

          {filteredFronts.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              ไม่พบแม่แบบหน้าบัตรที่ตรงกับคำค้นหา
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFronts.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Preview Stage */}
                  <div className="bg-slate-100/90 p-4 flex flex-col items-center justify-center border-b border-slate-200/70 relative">
                    <div className="w-full flex items-center justify-between gap-1.5 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tpl.level === 'มัธยมศึกษาตอนต้น'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tpl.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'}
                        </span>
                        {tpl.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            ค่าเริ่มต้น
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        อัปเดต {formatUpdatedDate(tpl.updatedAt)}
                      </span>
                    </div>

                    <div className="rounded-lg overflow-hidden shadow-md ring-1 ring-slate-300/60">
                      <CardPreview design={tpl} scale={0.76} />
                    </div>
                  </div>

                  {/* Info & Actions */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {tpl.name || tpl.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate font-sarabun mt-0.5">
                        {tpl.title} • {tpl.subtitle}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {/* Primary Edit Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingFront(JSON.parse(JSON.stringify(tpl)))}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-blue-600" />
                          <span>แก้ไขข้อมูล</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditInDesigner('front', tpl.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>แก้ไขดีไซน์</span>
                        </button>
                      </div>

                      {/* Secondary Row: Default / Duplicate / Delete */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {!tpl.isDefault ? (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultFront(tpl.id)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-amber-600 flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>ตั้งเป็นค่าเริ่มต้น</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            รูปแบบหลัก ({tpl.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'})
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateFront(tpl)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                            title="ทำสำเนาแม่แบบนี้"
                          >
                            <Copy className="w-3 h-3" />
                            <span>สำเนา</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteFront(tpl)}
                            disabled={frontDesigns.length <= 1}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors ${
                              frontDesigns.length <= 1
                                ? 'text-slate-300 border-slate-200 bg-slate-50 cursor-not-allowed'
                                : 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 cursor-pointer'
                            }`}
                            title={
                              frontDesigns.length <= 1
                                ? 'ต้องมีแม่แบบหน้าบัตรอย่างน้อย 1 รูปแบบ'
                                : 'ลบแม่แบบหน้าบัตรนี้'
                            }
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: BACK CARD TEMPLATES */}
      {(filterSide === 'all' || filterSide === 'back') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <FlipHorizontal2 className="w-4 h-4" />
              </span>
              แม่แบบหลังบัตร ({filteredBacks.length} รูปแบบ)
            </h3>
            <span className="text-[11px] text-slate-500 font-sarabun">
              * ระบบต้องมีแม่แบบหลังบัตรอย่างน้อย 1 รูปแบบ
            </span>
          </div>

          {filteredBacks.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              ไม่พบแม่แบบหลังบัตรที่ตรงกับคำค้นหา
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBacks.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Back Card Preview Stage */}
                  <div className="bg-slate-100/90 p-4 flex flex-col items-center justify-center border-b border-slate-200/70 relative">
                    <div className="w-full flex items-center justify-between gap-1.5 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tpl.displayMode === 'imageOnly'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {tpl.displayMode === 'imageOnly' ? 'ภาพเต็มใบ' : 'เทมเพลตข้อความ'}
                        </span>
                        {tpl.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            ค่าเริ่มต้น
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        อัปเดต {formatUpdatedDate(tpl.updatedAt)}
                      </span>
                    </div>

                    <div className="rounded-lg overflow-hidden shadow-md ring-1 ring-slate-300/60">
                      <BackCardPreview design={tpl} scale={0.76} />
                    </div>
                  </div>

                  {/* Info & Actions */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {tpl.name || tpl.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate font-sarabun mt-0.5">
                        {tpl.displayMode === 'imageOnly'
                          ? tpl.bgImageUrl
                            ? 'ภาพพื้นหลังเต็มใบ (CR80)'
                            : 'ยังไม่อัปโหลดภาพพื้นหลัง'
                          : `${tpl.title} • ${tpl.emergencyPhone || '-'}`}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {/* Primary Edit Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingBack(JSON.parse(JSON.stringify(tpl)))}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                          <span>แก้ไขข้อมูล</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditInDesigner('back', tpl.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>แก้ไขดีไซน์</span>
                        </button>
                      </div>

                      {/* Secondary Row: Default / Duplicate / Delete */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {!tpl.isDefault ? (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultBack(tpl.id)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-amber-600 flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>ตั้งเป็นค่าเริ่มต้น</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            รูปแบบหลักหลังบัตร
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBack(tpl)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                            title="ทำสำเนาแม่แบบนี้"
                          >
                            <Copy className="w-3 h-3" />
                            <span>สำเนา</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteBack(tpl)}
                            disabled={backDesigns.length <= 1}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors ${
                              backDesigns.length <= 1
                                ? 'text-slate-300 border-slate-200 bg-slate-50 cursor-not-allowed'
                                : 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 cursor-pointer'
                            }`}
                            title={
                              backDesigns.length <= 1
                                ? 'ต้องมีแม่แบบหลังบัตรอย่างน้อย 1 รูปแบบ'
                                : 'ลบแม่แบบหลังบัตรนี้'
                            }
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MODAL: QUICK EDIT FRONT TEMPLATE */}
      {editingFront && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                แก้ไขข้อมูลแม่แบบหน้าบัตร
              </h3>
              <button
                type="button"
                onClick={() => setEditingFront(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickFront} className="p-5 space-y-4 text-xs">
              <div className="flex justify-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                <CardPreview design={editingFront} scale={0.8} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อแม่แบบหน้าบัตร</label>
                  <input
                    type="text"
                    required
                    value={editingFront.name || ''}
                    onChange={(e) =>
                      setEditingFront((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ระดับชั้นแนะนำ</label>
                  <select
                    value={editingFront.level}
                    onChange={(e) =>
                      setEditingFront((prev) =>
                        prev ? { ...prev, level: e.target.value as EducationLevel } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น (ม.ต้น)</option>
                    <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย (ม.ปลาย)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">หัวข้อบัตร (Title)</label>
                  <input
                    type="text"
                    value={editingFront.title}
                    onChange={(e) =>
                      setEditingFront((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อสถานศึกษา (Subtitle)</label>
                  <input
                    type="text"
                    value={editingFront.subtitle}
                    onChange={(e) =>
                      setEditingFront((prev) =>
                        prev ? { ...prev, subtitle: e.target.value } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex-wrap">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingFront.isDefault)}
                    onChange={(e) =>
                      setEditingFront((prev) =>
                        prev ? { ...prev, isDefault: e.target.checked } : prev
                      )
                    }
                    className="rounded text-blue-600"
                  />
                  <span>ตั้งเป็นแม่แบบเริ่มต้นของ {editingFront.level}</span>
                </label>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setImagePickerSide('front')}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer inline-flex items-center gap-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>คลังรูป</span>
                  </button>
                  <label className={`px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer inline-flex items-center gap-1.5 ${isUploadingBg ? 'opacity-60 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {isUploadingBg ? 'กำลังบีบอัด...' : 'เปลี่ยนภาพพื้นหลัง'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingBg}
                      onChange={handleUploadFrontBg}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const id = editingFront.id;
                    setEditingFront(null);
                    onEditInDesigner('front', id);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  เปิดแก้ไขใน Designer เต็มรูปแบบ
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingFront(null)}
                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    บันทึกการแก้ไข
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK EDIT BACK TEMPLATE */}
      {editingBack && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                แก้ไขข้อมูลแม่แบบหลังบัตร
              </h3>
              <button
                type="button"
                onClick={() => setEditingBack(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickBack} className="p-5 space-y-4 text-xs">
              <div className="flex justify-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                <BackCardPreview design={editingBack} scale={0.8} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อแม่แบบหลังบัตร</label>
                  <input
                    type="text"
                    required
                    value={editingBack.name || ''}
                    onChange={(e) =>
                      setEditingBack((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">รูปแบบการแสดงผล</label>
                  <select
                    value={editingBack.displayMode}
                    onChange={(e) =>
                      setEditingBack((prev) =>
                        prev
                          ? { ...prev, displayMode: e.target.value as 'template' | 'imageOnly' }
                          : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="template">เทมเพลตข้อความอัตโนมัติ</option>
                    <option value="imageOnly">ภาพพื้นหลังเต็มใบ (Image Only)</option>
                  </select>
                </div>
              </div>

              {editingBack.displayMode === 'template' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">หัวข้อหลังบัตร</label>
                      <input
                        type="text"
                        value={editingBack.title}
                        onChange={(e) =>
                          setEditingBack((prev) =>
                            prev ? { ...prev, title: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">หัวข้อรอง / ชื่อโรงเรียน</label>
                      <input
                        type="text"
                        value={editingBack.subtitle}
                        onChange={(e) =>
                          setEditingBack((prev) =>
                            prev ? { ...prev, subtitle: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">หัวข้อติดต่อฉุกเฉิน</label>
                      <input
                        type="text"
                        value={editingBack.emergencyLabel}
                        onChange={(e) =>
                          setEditingBack((prev) =>
                            prev ? { ...prev, emergencyLabel: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">เบอร์โทรติดต่อ</label>
                      <input
                        type="text"
                        value={editingBack.emergencyPhone}
                        onChange={(e) =>
                          setEditingBack((prev) =>
                            prev ? { ...prev, emergencyPhone: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      ข้อความหมายเหตุด้านล่าง
                    </label>
                    <input
                      type="text"
                      value={editingBack.footerNote}
                      onChange={(e) =>
                        setEditingBack((prev) =>
                          prev ? { ...prev, footerNote: e.target.value } : prev
                        )
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex items-center justify-between gap-3">
                  <span className="text-indigo-900 font-sarabun">
                    {editingBack.bgImageUrl
                      ? 'อัปโหลดภาพพื้นหลังเต็มใบแล้ว'
                      : 'ยังไม่อัปโหลดภาพพื้นหลังเต็มใบ'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setImagePickerSide('back')}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer inline-flex items-center gap-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>คลังรูป</span>
                    </button>
                    <label className={`px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${isUploadingBg ? 'opacity-60 pointer-events-none' : ''}`}>
                      <Upload className="w-3.5 h-3.5" />
                      {isUploadingBg ? 'กำลังบีบอัด...' : 'อัปโหลดภาพใหม่'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingBg}
                        onChange={handleUploadBackBg}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex-wrap">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingBack.isDefault)}
                    onChange={(e) =>
                      setEditingBack((prev) =>
                        prev ? { ...prev, isDefault: e.target.checked } : prev
                      )
                    }
                    className="rounded text-indigo-600"
                  />
                  <span>ตั้งเป็นแม่แบบหลังบัตรเริ่มต้น</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const id = editingBack.id;
                    setEditingBack(null);
                    onEditInDesigner('back', id);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  เปิดแก้ไขใน Designer เต็มรูปแบบ
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBack(null)}
                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    บันทึกการแก้ไข
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW TEMPLATE */}
      {createModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Plus
                  className={`w-4 h-4 ${
                    createModal.side === 'front' ? 'text-blue-600' : 'text-indigo-600'
                  }`}
                />
                {createModal.side === 'front'
                  ? 'สร้างแม่แบบหน้าบัตรใหม่'
                  : 'สร้างแม่แบบหลังบัตรใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModal((m) => ({ ...m, open: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อแม่แบบใหม่</label>
                <input
                  type="text"
                  autoFocus
                  value={createModal.name}
                  onChange={(e) => setCreateModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="ระบุชื่อแม่แบบ เช่น แบบมาตรฐาน ปี 2569"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {createModal.side === 'front' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ระดับชั้นแนะนำ</label>
                  <select
                    value={createModal.level}
                    onChange={(e) =>
                      setCreateModal((m) => ({
                        ...m,
                        level: e.target.value as EducationLevel,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น (ม.ต้น)</option>
                    <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย (ม.ปลาย)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">รูปแบบหลังบัตร</label>
                  <select
                    value={createModal.displayMode}
                    onChange={(e) =>
                      setCreateModal((m) => ({
                        ...m,
                        displayMode: e.target.value as 'template' | 'imageOnly',
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="template">เทมเพลตข้อความอัตโนมัติ</option>
                    <option value="imageOnly">ภาพพื้นหลังเต็มใบ (Image Only)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModal((m) => ({ ...m, open: false }))}
                  className="px-3.5 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateTemplate(false)}
                  className="px-3.5 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-semibold cursor-pointer"
                >
                  บันทึกไว้ก่อน
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateTemplate(true)}
                  className={`px-4 py-2 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer ${
                    createModal.side === 'front'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  สร้างและเปิดแก้ไขดีไซน์
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    ยืนยันการลบแม่แบบ{deleteTarget.side === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}
                  </h3>
                  <p className="text-xs text-slate-600 font-sarabun leading-relaxed">
                    คุณต้องการลบแม่แบบ{' '}
                    <strong className="text-slate-900">"{deleteTarget.name}"</strong>{' '}
                    ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </p>
                  {deleteTarget.isDefault && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-sarabun mt-2">
                      แม่แบบนี้อยู่ในสถานะค่าเริ่มต้น ระบบจะเลื่อนแม่แบบอื่นที่เหลือขึ้นมาเป็นค่าเริ่มต้นแทนโดยอัตโนมัติ
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ยืนยันลบแม่แบบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <FirebaseImagePickerModal
        isOpen={Boolean(imagePickerSide)}
        onClose={() => setImagePickerSide(null)}
        initialCategory={imagePickerSide === 'back' ? 'back_bg' : 'front_bg'}
        title={
          imagePickerSide === 'back'
            ? 'เลือกภาพพื้นหลังหลังบัตรจากฐานข้อมูล Firebase'
            : 'เลือกภาพพื้นหลังหน้าบัตรจากฐานข้อมูล Firebase'
        }
        onNotify={onNotify}
        onSelect={(asset) => {
          const refUrl = asset.storageUrl || `firestore-asset://${asset.id}`;
          if (imagePickerSide === 'front') {
            setEditingFront((prev) =>
              prev
                ? {
                    ...prev,
                    bgImageUrl: refUrl,
                    bgImageStoragePath: asset.storagePath || '',
                    bgImageAssetId: asset.id,
                    bgType: 'custom',
                  }
                : prev
            );
          } else if (imagePickerSide === 'back') {
            setEditingBack((prev) =>
              prev
                ? {
                    ...prev,
                    bgImageUrl: refUrl,
                    bgImageStoragePath: asset.storagePath || '',
                    bgImageAssetId: asset.id,
                  }
                : prev
            );
          }
          onNotify(`เลือกรูป "${asset.fileName}" จาก Firebase แล้ว`, 'success');
        }}
      />
    </div>
  );
};
