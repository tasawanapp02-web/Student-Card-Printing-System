import React, { useState, useEffect } from 'react';
import {
  BackCardDesignConfig,
  TrayCalibrationConfig,
  UserAccount,
  PrintPreviewPayload,
} from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize } from '../utils/imageOptimizer';
import { DEFAULT_TRAY_CONFIG, DEFAULT_BACK_CARD_DESIGN } from '../utils/defaultData';
import { BackCardPreview } from './BackCardPreview';
import { TrayCalibrationPanel } from './TrayCalibrationPanel';
import { openPrintPreviewInNewTab } from '../utils/printPreview';
import {
  Printer,
  SlidersHorizontal,
  CheckCircle2,
  Eye,
  Upload,
  RotateCcw,
  Save,
  RotateCw,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  Trash2,
  Layers,
  BookmarkPlus,
  X,
} from 'lucide-react';

interface PvcBackPrintViewProps {
  currentUser: UserAccount | null;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const PvcBackPrintView: React.FC<PvcBackPrintViewProps> = ({
  currentUser,
  onNotify,
}) => {
  const [trayConfig, setTrayConfig] = useState<TrayCalibrationConfig>(() =>
    storageService.getTrayConfig()
  );
  const [backDesigns, setBackDesigns] = useState<BackCardDesignConfig[]>(() =>
    storageService.getBackDesigns()
  );
  const [backDesign, setBackDesign] = useState<BackCardDesignConfig>(() =>
    storageService.getBackCardDesign()
  );
  const [hasDesignChanges, setHasDesignChanges] = useState<boolean>(false);

  // Allow choosing same template for both slots OR different templates per slot
  const [usePerSlotTemplate, setUsePerSlotTemplate] = useState<boolean>(false);
  const [slot1BackDesignId, setSlot1BackDesignId] = useState<string>(
    () => storageService.getBackCardDesign().id
  );
  const [slot2BackDesignId, setSlot2BackDesignId] = useState<string>(
    () => storageService.getBackCardDesign().id
  );

  const [enableSlot1, setEnableSlot1] = useState<boolean>(true);
  const [enableSlot2, setEnableSlot2] = useState<boolean>(true);
  const [rotate180Slot1, setRotate180Slot1] = useState<boolean>(false);
  const [rotate180Slot2, setRotate180Slot2] = useState<boolean>(false);

  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [showTestPattern, setShowTestPattern] = useState<boolean>(false);

  // Save As New Template modal
  const [saveAsModalOpen, setSaveAsModalOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');

  // Fallback modal URL if browser blocks popup
  const [blockedPreviewUrl, setBlockedPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  useEffect(() => {
    return storageService.subscribe(() => {
      setTrayConfig(storageService.getTrayConfig());
      setBackDesigns(storageService.getBackDesigns());
    });
  }, []);

  const updateBackDesign = (patch: Partial<BackCardDesignConfig>) => {
    setBackDesign((prev) => ({ ...prev, ...patch }));
    setHasDesignChanges(true);
  };

  const handleSelectSharedBackTemplate = (id: string) => {
    if (
      hasDesignChanges &&
      !confirm('มีการแก้ไขหลังบัตรที่ยังไม่ได้บันทึก ต้องการเปลี่ยนรูปแบบโดยไม่บันทึกใช่หรือไม่?')
    ) {
      return;
    }
    const found = backDesigns.find((d) => d.id === id);
    if (found) {
      setBackDesign(found);
      setSlot1BackDesignId(found.id);
      setSlot2BackDesignId(found.id);
      setHasDesignChanges(false);
    }
  };

  const resolvedSlot1Back = usePerSlotTemplate
    ? backDesigns.find((d) => d.id === slot1BackDesignId) || backDesign
    : backDesign;
  const resolvedSlot2Back = usePerSlotTemplate
    ? backDesigns.find((d) => d.id === slot2BackDesignId) || backDesign
    : backDesign;

  const handleSaveCalibration = () => {
    storageService.saveTrayConfig(trayConfig);
    onNotify(
      `บันทึกพิกัดและขนาดถาดพิมพ์ (${trayConfig.trayWidthMm} × ${trayConfig.trayHeightMm} มม.) ใช้ร่วมกันทั้งหน้าและหลังบัตรเรียบร้อยแล้ว`,
      'success'
    );
    setIsCalibrating(false);
  };

  const handleResetCalibration = () => {
    if (
      confirm(
        'ต้องการรีเซ็ตพิกัดและขนาดถาดพิมพ์กลับเป็นค่ามาตรฐาน EPSON L850 (130 × 220 มม.) หรือไม่? (มีผลทั้งหน้าบัตรและหลังบัตร)'
      )
    ) {
      setTrayConfig(DEFAULT_TRAY_CONFIG);
      storageService.saveTrayConfig(DEFAULT_TRAY_CONFIG);
      onNotify('รีเซ็ตพิกัดและขนาดถาดพิมพ์เรียบร้อยแล้ว', 'info');
    }
  };

  const handleToggleRotateTray180 = () => {
    const nextRotate = !trayConfig.rotate180;
    const nextConfig: TrayCalibrationConfig = {
      ...trayConfig,
      rotate180: nextRotate,
    };
    setTrayConfig(nextConfig);
    storageService.saveTrayConfig(nextConfig);
    onNotify(
      nextRotate
        ? 'เปิดการหมุนถาดพิมพ์บัตร 180° (ใช้ร่วมกันทั้งหน้าและหลังบัตร)'
        : 'ปิดการหมุนถาดพิมพ์บัตร 180° (กลับสู่ทิศทางปกติ)',
      'info'
    );
  };

  const handleSaveBackDesign = () => {
    const updated = storageService.saveBackDesign(backDesign);
    setBackDesigns(updated);
    const saved = updated.find((d) => d.id === backDesign.id);
    if (saved) setBackDesign(saved);
    setHasDesignChanges(false);
    onNotify(`บันทึกรูปแบบหลังบัตร "${backDesign.name || backDesign.title}" เรียบร้อยแล้ว`, 'success');
  };

  const handleSaveAsNewBackTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTemplateName.trim();
    if (!trimmed) {
      onNotify('กรุณาระบุชื่อรูปแบบหลังบัตรใหม่', 'error');
      return;
    }
    const created: BackCardDesignConfig = {
      ...JSON.parse(JSON.stringify(backDesign)),
      id: `design_back_${Date.now()}`,
      name: trimmed,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveBackDesign(created);
    setBackDesigns(updated);
    setBackDesign(created);
    setSlot1BackDesignId(created.id);
    setSlot2BackDesignId(created.id);
    setHasDesignChanges(false);
    setSaveAsModalOpen(false);
    setNewTemplateName('');
    onNotify(`บันทึกรูปแบบหลังบัตรใหม่ "${trimmed}" เรียบร้อยแล้ว`, 'success');
  };

  const handleResetBackDesign = () => {
    if (confirm('ต้องการรีเซ็ตการตั้งค่าของแบบหลังบัตรนี้กลับเป็นค่าเริ่มต้นใช่หรือไม่?')) {
      const resetVal: BackCardDesignConfig = {
        ...JSON.parse(JSON.stringify(DEFAULT_BACK_CARD_DESIGN)),
        id: backDesign.id,
        name: backDesign.name,
        isDefault: backDesign.isDefault,
      };
      const updated = storageService.saveBackDesign(resetVal);
      setBackDesigns(updated);
      setBackDesign(resetVal);
      setHasDesignChanges(false);
      onNotify('รีเซ็ตแบบหลังบัตรกลับเป็นค่าเริ่มต้นแล้ว', 'info');
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const uploaded = await storageService.uploadCardDesignImage(file, 'back', backDesign.id);
      updateBackDesign({
        bgImageUrl: uploaded.url,
        bgImageStoragePath: uploaded.storagePath,
        bgImageAssetId: uploaded.assetId,
      });
      onNotify(
        `บีบอัดและอัปโหลดภาพพื้นหลังหลังบัตรสำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)})`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        'error'
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePrintBack = () => {
    if (!enableSlot1 && !enableSlot2) {
      onNotify('กรุณาเปิดใช้งานอย่างน้อย 1 ช่องบัตรบนถาดพิมพ์', 'error');
      return;
    }

    if (
      enableSlot1 &&
      resolvedSlot1Back.displayMode === 'imageOnly' &&
      !resolvedSlot1Back.bgImageUrl
    ) {
      onNotify('ช่องที่ 1: กรุณาอัปโหลดไฟล์ภาพหลังบัตร (.PNG/.JPG) ก่อนสั่งพิมพ์', 'error');
      return;
    }

    if (
      enableSlot2 &&
      resolvedSlot2Back.displayMode === 'imageOnly' &&
      !resolvedSlot2Back.bgImageUrl
    ) {
      onNotify('ช่องที่ 2: กรุณาอัปโหลดไฟล์ภาพหลังบัตร (.PNG/.JPG) ก่อนสั่งพิมพ์', 'error');
      return;
    }

    // Persist latest back design & tray config before opening preview tab
    if (!usePerSlotTemplate) {
      const updated = storageService.saveBackDesign(backDesign);
      setBackDesigns(updated);
      setHasDesignChanges(false);
    }
    storageService.saveTrayConfig(trayConfig);

    const payload: PrintPreviewPayload = {
      id: `prev_back_${Date.now()}`,
      createdAt: new Date().toISOString(),
      side: 'back',
      trayConfig,
      enableSlot1,
      enableSlot2,
      slot1BackDesignId: resolvedSlot1Back.id,
      slot2BackDesignId: resolvedSlot2Back.id,
      backSlot1Rotate180: rotate180Slot1,
      backSlot2Rotate180: rotate180Slot2,
      operatorName: currentUser?.fullName || 'เจ้าหน้าที่ผู้พิมพ์',
    };

    const result = openPrintPreviewInNewTab(payload);
    if (result.opened) {
      onNotify('เปิดหน้าตัวอย่างการพิมพ์หลังบัตรในแท็บใหม่เรียบร้อยแล้ว', 'success');
    } else {
      setBlockedPreviewUrl(result.url);
      onNotify('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณากดปุ่มเปิดแท็บตัวอย่างด้านล่าง', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            ระบบพิมพ์หลังบัตรลงถาด PVC ({trayConfig.printerProfile || 'EPSON / Canon Series'})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            เลือกรูปแบบหลังบัตรที่บันทึกไว้ได้ทันที หรือแก้ไขด่วนก่อนพิมพ์ (ขนาดถาด {trayConfig.trayWidthMm} ×{' '}
            {trayConfig.trayHeightMm} มม. / บัตร {trayConfig.cardWidthMm} ×{' '}
            {trayConfig.cardHeightMm} มม.)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleToggleRotateTray180}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
              trayConfig.rotate180
                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title="หมุนทั้งถาดพิมพ์บัตร 180 องศา"
          >
            <RotateCw className={`w-4 h-4 ${trayConfig.rotate180 ? 'text-white' : 'text-indigo-600'}`} />
            {trayConfig.rotate180 ? 'หมุนถาด 180° (เปิดอยู่)' : 'หมุนถาด 180°'}
          </button>

          <button
            type="button"
            onClick={() => setIsCalibrating(!isCalibrating)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
              isCalibrating
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            {isCalibrating ? 'ปิดการตั้งค่าพิกัด/ขนาดถาด' : 'ตั้งค่าพิกัดถาด PVC ร่วมกัน'}
          </button>

          <button
            type="button"
            onClick={handlePrintBack}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            สั่งพิมพ์หลังบัตร (แสดงตัวอย่างแท็บใหม่)
          </button>
        </div>
      </div>

      {/* Shared Tray Calibration Panel */}
      {isCalibrating && (
        <TrayCalibrationPanel
          trayConfig={trayConfig}
          onChange={setTrayConfig}
          showTestPattern={showTestPattern}
          onToggleTestPattern={() => setShowTestPattern(!showTestPattern)}
          onSave={handleSaveCalibration}
          onReset={handleResetCalibration}
          onNotify={onNotify}
        />
      )}

      {/* Main Grid: Left Controls (Template Selector + Slots + Back Card Editor), Right Tray Visual Preview */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Saved Back Templates Picker Box */}
          <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                เลือกรูปแบบหลังบัตรที่ออกแบบไว้ ({backDesigns.length} แบบ)
              </span>

              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full cursor-pointer border border-indigo-200">
                <input
                  type="checkbox"
                  checked={usePerSlotTemplate}
                  onChange={(e) => setUsePerSlotTemplate(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>เลือกแบบแยกช่อง 1 และ 2</span>
              </label>
            </div>

            {!usePerSlotTemplate ? (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600">
                  รูปแบบหลังบัตรที่ใช้พิมพ์ทั้ง 2 ช่อง:
                </label>
                <select
                  value={backDesign.id}
                  onChange={(e) => handleSelectSharedBackTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sarabun"
                >
                  {backDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.title} ({d.displayMode === 'imageOnly' ? 'ภาพเต็มใบ' : 'เทมเพลต'})
                      {d.isDefault ? ' ★ ค่าเริ่มต้น' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 font-sarabun">
                โหมดแยกช่อง: สามารถเลือกแบบหลังบัตรสำหรับช่องที่ 1 และช่องที่ 2 ด้านล่างแยกจากกันได้
              </p>
            )}
          </div>

          {/* Tray Slot Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">
                เลือกช่องบัตรที่จะพิมพ์ด้านหลัง
              </span>
              <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-semibold">
                ใช้พิกัดถาด PVC เดียวกัน
              </span>
            </div>

            {/* Slot 1 Row */}
            <div
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                enableSlot1 ? 'bg-slate-50 border-indigo-200' : 'bg-slate-50/50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSlot1}
                    onChange={(e) => setEnableSlot1(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    บัตรใบที่ 1 (ตำแหน่งบน: {trayConfig.card1X}, {trayConfig.card1Y} mm)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setRotate180Slot1((v) => !v)}
                  disabled={!enableSlot1}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                    rotate180Slot1
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="กลับหัว 180 องศาสำหรับถาดพิมพ์"
                >
                  <RotateCw className="w-3 h-3" />
                  หมุน 180°
                </button>
              </div>

              {usePerSlotTemplate && enableSlot1 && (
                <select
                  value={slot1BackDesignId}
                  onChange={(e) => setSlot1BackDesignId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sarabun"
                >
                  {backDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      ช่อง 1: {d.name || d.title}
                      {d.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Slot 2 Row */}
            <div
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                enableSlot2 ? 'bg-slate-50 border-indigo-200' : 'bg-slate-50/50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSlot2}
                    onChange={(e) => setEnableSlot2(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    บัตรใบที่ 2 (ตำแหน่งล่าง: {trayConfig.card2X}, {trayConfig.card2Y} mm)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setRotate180Slot2((v) => !v)}
                  disabled={!enableSlot2}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                    rotate180Slot2
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="กลับหัว 180 องศาสำหรับถาดพิมพ์"
                >
                  <RotateCw className="w-3 h-3" />
                  หมุน 180°
                </button>
              </div>

              {usePerSlotTemplate && enableSlot2 && (
                <select
                  value={slot2BackDesignId}
                  onChange={(e) => setSlot2BackDesignId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sarabun"
                >
                  {backDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      ช่อง 2: {d.name || d.title}
                      {d.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Back Card Quick Editor (Shown when editing shared template) */}
          {!usePerSlotTemplate && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2 flex-wrap">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    ปรับแต่งด่วน: {backDesign.name || backDesign.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleResetBackDesign}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
                    title="รีเซ็ตแบบหลังบัตร"
                  >
                    <RotateCcw className="w-3 h-3" />
                    รีเซ็ต
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTemplateName(`${backDesign.name || backDesign.title} (ใหม่)`);
                      setSaveAsModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    บันทึกเป็นแบบใหม่
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBackDesign}
                    disabled={!hasDesignChanges}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all ${
                      hasDesignChanges
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-3 h-3" />
                    บันทึกทับ
                  </button>
                </div>
              </div>

              {/* Display Mode Switch */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => updateBackDesign({ displayMode: 'template' })}
                  className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    backDesign.displayMode === 'template'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  เทมเพลตแก้ไขได้
                </button>
                <button
                  type="button"
                  onClick={() => updateBackDesign({ displayMode: 'imageOnly' })}
                  className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    backDesign.displayMode === 'imageOnly'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  ใช้ไฟล์ภาพเต็มใบ
                </button>
              </div>

              {/* Image Upload Bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[11px] text-slate-600 font-sarabun">
                  {backDesign.bgImageUrl
                    ? 'อัปโหลดภาพพื้นหลังแล้ว (ขนาด CR80)'
                    : backDesign.displayMode === 'imageOnly'
                    ? 'อัปโหลดไฟล์ภาพ .PNG / .JPG สำหรับหลังบัตรเต็มใบ'
                    : 'อัปโหลดภาพพื้นหลังเพิ่มเติมได้ (ไม่บังคับ)'}
                </div>
                <div className="flex items-center gap-1.5">
                  {backDesign.bgImageUrl && (
                    <button
                      type="button"
                      onClick={() => updateBackDesign({ bgImageUrl: '', bgImageStoragePath: '' })}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      ลบภาพ
                    </button>
                  )}
                  <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 transition-colors ${isUploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? 'กำลังบีบอัด...' : 'อัปโหลดภาพ .PNG/.JPG'}</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/*"
                      disabled={isUploadingImage}
                      onChange={handleBgImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Template Text & Colors Controls */}
              {backDesign.displayMode === 'template' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      หัวข้อหลังบัตร
                    </label>
                    <input
                      type="text"
                      value={backDesign.title}
                      onChange={(e) => updateBackDesign({ title: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชื่อสถานศึกษา / หน่วยงาน
                    </label>
                    <input
                      type="text"
                      value={backDesign.subtitle}
                      onChange={(e) => updateBackDesign({ subtitle: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sarabun"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ข้อปฏิบัติ / เงื่อนไขการใช้บัตร (บรรทัดละ 1 ข้อ สูงสุด 5 ข้อ)
                    </label>
                    <textarea
                      rows={4}
                      value={backDesign.rules.join('\n')}
                      onChange={(e) =>
                        updateBackDesign({ rules: e.target.value.split('\n') })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-[11px] leading-relaxed font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        หัวข้อติดต่อฉุกเฉิน
                      </label>
                      <input
                        type="text"
                        value={backDesign.emergencyLabel}
                        onChange={(e) =>
                          updateBackDesign({ emergencyLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-sarabun"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        เบอร์โทรศัพท์ติดต่อ
                      </label>
                      <input
                        type="text"
                        value={backDesign.emergencyPhone}
                        onChange={(e) =>
                          updateBackDesign({ emergencyPhone: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      หมายเหตุด้านล่างบัตร
                    </label>
                    <input
                      type="text"
                      value={backDesign.footerNote}
                      onChange={(e) => updateBackDesign({ footerNote: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-sarabun"
                    />
                  </div>

                  {/* Colors & Options */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        สีหัวข้อ/แถบ
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={backDesign.accentColor}
                          onChange={(e) =>
                            updateBackDesign({ accentColor: e.target.value })
                          }
                          className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-600">
                          {backDesign.accentColor}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        สีพื้นหลัง
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={backDesign.bgColor}
                          onChange={(e) => updateBackDesign({ bgColor: e.target.value })}
                          className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-600">
                          {backDesign.bgColor}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        สีข้อความ
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={backDesign.textColor}
                          onChange={(e) =>
                            updateBackDesign({ textColor: e.target.value })
                          }
                          className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-600">
                          {backDesign.textColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backDesign.showLogo}
                        onChange={(e) =>
                          updateBackDesign({ showLogo: e.target.checked })
                        }
                        className="rounded text-indigo-600"
                      />
                      <span>แสดงตราโรงเรียน</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backDesign.showSignatureBox}
                        onChange={(e) =>
                          updateBackDesign({ showSignatureBox: e.target.checked })
                        }
                        className="rounded text-indigo-600"
                      />
                      <span>แสดงช่องลงนาม</span>
                    </label>
                  </div>

                  {backDesign.showSignatureBox && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        คำใต้เส้นลงนาม
                      </label>
                      <input
                        type="text"
                        value={backDesign.signatureLabel}
                        onChange={(e) =>
                          updateBackDesign({ signatureLabel: e.target.value })
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-sarabun"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tray Profile Info Notice */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ขนาดถาดปัจจุบัน: {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} มม. (
              {trayConfig.printerProfile || 'กำหนดเอง'})
            </div>
            <p className="text-[11px] text-slate-500 font-sarabun">
              เมื่อกดสั่งพิมพ์ ระบบจะเปิดหน้าตัวอย่างการพิมพ์ในแท็บใหม่เพื่อให้ตรวจสอบความเรียบร้อยก่อนพิมพ์จริงลงถาด PVC
            </p>
          </div>
        </div>

        {/* Right Column: Physical PVC Tray Visualizer */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>
                จำลองการวางหลังบัตรบนถาดจริง ({trayConfig.trayWidthMm} ×{' '}
                {trayConfig.trayHeightMm} มม.)
              </span>
              {trayConfig.rotate180 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                  <RotateCw className="w-3 h-3" />
                  หมุนถาด 180°
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              ช่อง 1: ({trayConfig.card1X}, {trayConfig.card1Y}) | ช่อง 2: (
              {trayConfig.card2X}, {trayConfig.card2Y}) มม.
            </span>
          </div>

          {/* Physical Tray Simulation */}
          <div className="py-4 px-6 bg-slate-100 rounded-2xl border border-slate-200 flex justify-center w-full overflow-auto max-h-[640px]">
            <div
              className="relative bg-slate-800 rounded-none shadow-2xl border-4 border-slate-900 select-none overflow-hidden transition-all shrink-0"
              style={{
                width: `${trayConfig.trayWidthMm * 2.4}px`,
                height: `${trayConfig.trayHeightMm * 2.4}px`,
              }}
            >
              <div
                className="w-full h-full relative transition-transform duration-300"
                style={{
                  transform: trayConfig.rotate180 ? 'rotate(180deg)' : undefined,
                  transformOrigin: 'center center',
                }}
              >
                {/* Tray Header Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-2.5 bg-slate-900 rounded-b-lg border-x border-b border-slate-700" />
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 font-mono tracking-wider uppercase whitespace-nowrap">
                  EPSON PVC CARD TRAY
                </div>

                {/* Slot 1 Guide Cutout */}
                <div
                  className={`absolute transition-all rounded-[5px] ${
                    enableSlot1 ? 'shadow-md ring-2 ring-indigo-400/60' : 'opacity-30'
                  }`}
                  style={{
                    left: `${trayConfig.card1X * 2.4}px`,
                    top: `${trayConfig.card1Y * 2.4}px`,
                    width: `${trayConfig.cardWidthMm * 2.4}px`,
                    height: `${trayConfig.cardHeightMm * 2.4}px`,
                  }}
                >
                  {enableSlot1 ? (
                    <BackCardPreview
                      design={resolvedSlot1Back}
                      scale={(trayConfig.cardWidthMm * 2.4) / 323.5}
                      rotate180={rotate180Slot1}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700/80 border-2 border-dashed border-slate-500 rounded-[5px] flex items-center justify-center text-slate-400 text-xs font-medium">
                      ปิดการพิมพ์
                    </div>
                  )}

                  {showTestPattern && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500" />
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500" />
                      <span className="absolute top-1 left-1 text-[8px] text-red-400 font-mono">
                        1
                      </span>
                    </div>
                  )}
                </div>

                {/* Slot 2 Guide Cutout */}
                <div
                  className={`absolute transition-all rounded-[5px] ${
                    enableSlot2 ? 'shadow-md ring-2 ring-indigo-400/60' : 'opacity-30'
                  }`}
                  style={{
                    left: `${trayConfig.card2X * 2.4}px`,
                    top: `${trayConfig.card2Y * 2.4}px`,
                    width: `${trayConfig.cardWidthMm * 2.4}px`,
                    height: `${trayConfig.cardHeightMm * 2.4}px`,
                  }}
                >
                  {enableSlot2 ? (
                    <BackCardPreview
                      design={resolvedSlot2Back}
                      scale={(trayConfig.cardWidthMm * 2.4) / 323.5}
                      rotate180={rotate180Slot2}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700/80 border-2 border-dashed border-slate-500 rounded-[5px] flex items-center justify-center text-slate-400 text-xs font-medium">
                      ปิดการพิมพ์
                    </div>
                  )}

                  {showTestPattern && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500" />
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500" />
                      <span className="absolute top-1 left-1 text-[8px] text-red-400 font-mono">
                        2
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Tray Arrow Feed Direction Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-slate-400">
                  <span className="text-[9px] font-mono tracking-widest uppercase whitespace-nowrap">
                    FEED ARROW (BACK) ▼
                  </span>
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-400"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save As New Template Modal */}
      {saveAsModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-indigo-600" />
                บันทึกเป็นรูปแบบหลังบัตรใหม่
              </h3>
              <button
                type="button"
                onClick={() => setSaveAsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAsNewBackTemplate} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ชื่อรูปแบบหลังบัตรใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="เช่น หลังบัตรฉบับปรับปรุง 2569"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSaveAsModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  บันทึกรูปแบบใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Blocked Fallback Modal */}
      {blockedPreviewUrl && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              เปิดหน้าตัวอย่างการพิมพ์ในแท็บใหม่
            </h3>
            <p className="text-xs text-slate-600 font-sarabun leading-relaxed">
              เบราว์เซอร์ป้องกันการเปิดแท็บใหม่อัตโนมัติ กรุณากดปุ่มด้านล่างเพื่อเปิดหน้าตัวอย่างการพิมพ์หลังบัตรในแท็บใหม่
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBlockedPreviewUrl(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                ปิด
              </button>
              <a
                href={blockedPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBlockedPreviewUrl(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                เปิดหน้าตัวอย่างในแท็บใหม่
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
