import React, { useState, useEffect } from 'react';
import {
  CardDesignConfig,
  BackCardDesignConfig,
  EducationLevel,
  CardElementStyle,
  CardDateFormat,
  LabelLayoutMode,
  ClassDisplayMode,
  Guardian,
  ImageAsset,
} from '../types';
import { CardPreview } from './CardPreview';
import { BackCardPreview } from './BackCardPreview';
import { FirebaseImagePickerModal } from './FirebaseImagePickerModal';
import { storageService } from '../utils/storage';
import { formatFileSize } from '../utils/imageOptimizer';
import {
  DEFAULT_JUNIOR_DESIGN,
  DEFAULT_SENIOR_DESIGN,
  DEFAULT_JUNIOR_HIGH_BG,
  DEFAULT_SENIOR_HIGH_BG,
  DEFAULT_BACK_CARD_DESIGN,
  CARD_FONT_OPTIONS,
} from '../utils/defaultData';
import {
  Sliders,
  Upload,
  RotateCcw,
  Save,
  Eye,
  Type,
  Image as ImageIcon,
  Move,
  Layers,
  Plus,
  Copy,
  Trash2,
  Star,
  FlipHorizontal2,
  CreditCard,
  FileText,
  RotateCw,
  X,
  Check,
  BookmarkPlus,
  Pencil,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface CardDesignerProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  initialTarget?: {
    side: 'front' | 'back';
    templateId: string;
    nonce: number;
  } | null;
}

type EditableElementKey =
  | 'title'
  | 'subtitle'
  | 'guardianPhoto'
  | 'guardianName'
  | 'studentName'
  | 'studentClass'
  | 'studentId'
  | 'issueDate'
  | 'expiryDate'
  | 'qrCode'
  | 'schoolLogo';

interface ElementMeta {
  key: EditableElementKey;
  label: string;
  isImageOrBox?: boolean;
}

const ELEMENT_METAS: ElementMeta[] = [
  { key: 'guardianPhoto', label: '1. รูปถ่ายผู้ปกครอง (Photo Box)', isImageOrBox: true },
  { key: 'guardianName', label: '2. ชื่อ-นามสกุล ผู้ถือบัตร (ผู้ปกครอง)' },
  { key: 'studentName', label: '3. ชื่อ-นามสกุล นักเรียน' },
  { key: 'studentClass', label: '4. ระดับชั้น / ห้องเรียน' },
  { key: 'studentId', label: '5. เลขประจำตัวนักเรียน 5 หลัก' },
  { key: 'issueDate', label: '6. วันที่ออกบัตร (พ.ศ.)' },
  { key: 'expiryDate', label: '7. วันหมดอายุบัตร (พ.ศ.)' },
  { key: 'title', label: '8. หัวข้อบัตร (Title Header)' },
  { key: 'subtitle', label: '9. ชื่อสถานศึกษา (Subtitle)' },
  { key: 'qrCode', label: '10. QR Code ตรวจสอบสิทธิ์', isImageOrBox: true },
  { key: 'schoolLogo', label: '11. ตราสัญลักษณ์ / ตราโรงเรียน', isImageOrBox: true },
];

export const CardDesigner: React.FC<CardDesignerProps> = ({
  onNotify,
  initialTarget,
}) => {
  const [designSide, setDesignSide] = useState<'front' | 'back'>(
    () => initialTarget?.side || 'front'
  );

  // Front Templates State
  const [frontDesigns, setFrontDesigns] = useState<CardDesignConfig[]>(() =>
    storageService.getFrontDesigns()
  );
  const [currentFront, setCurrentFront] = useState<CardDesignConfig>(() => {
    const all = storageService.getFrontDesigns();
    if (initialTarget?.side === 'front') {
      const matched = all.find((d) => d.id === initialTarget.templateId);
      if (matched) return matched;
    }
    return all.find((d) => d.isDefault) || all[0] || DEFAULT_JUNIOR_DESIGN;
  });

  // Back Templates State
  const [backDesigns, setBackDesigns] = useState<BackCardDesignConfig[]>(() =>
    storageService.getBackDesigns()
  );
  const [currentBack, setCurrentBack] = useState<BackCardDesignConfig>(() => {
    const all = storageService.getBackDesigns();
    if (initialTarget?.side === 'back') {
      const matched = all.find((d) => d.id === initialTarget.templateId);
      if (matched) return matched;
    }
    return all.find((d) => d.isDefault) || all[0] || DEFAULT_BACK_CARD_DESIGN;
  });

  const [selectedKey, setSelectedKey] = useState<EditableElementKey>('guardianPhoto');
  const [previewScale, setPreviewScale] = useState<number>(1.3);
  const [previewBackRotate180, setPreviewBackRotate180] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [sampleGuardianPhoto, setSampleGuardianPhoto] = useState<string>(() =>
    storageService.getDesignerSamplePhoto()
  );
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<
    null | 'frontBg' | 'backBg' | 'samplePhoto'
  >(null);

  useEffect(() => {
    return storageService.subscribe(() => {
      setFrontDesigns(storageService.getFrontDesigns());
      setBackDesigns(storageService.getBackDesigns());
      setGuardians(storageService.getGuardians());
      setSampleGuardianPhoto(storageService.getDesignerSamplePhoto());
    });
  }, []);

  useEffect(() => {
    if (!initialTarget) return;
    const latestFronts = storageService.getFrontDesigns();
    const latestBacks = storageService.getBackDesigns();
    setFrontDesigns(latestFronts);
    setBackDesigns(latestBacks);
    setDesignSide(initialTarget.side);
    if (initialTarget.side === 'front') {
      const found = latestFronts.find((d) => d.id === initialTarget.templateId);
      if (found) setCurrentFront(found);
    } else {
      const found = latestBacks.find((d) => d.id === initialTarget.templateId);
      if (found) setCurrentBack(found);
    }
    setHasChanges(false);
  }, [initialTarget]);

  // Create / Save-As-New Template Modal
  const [templateModal, setTemplateModal] = useState<{
    open: boolean;
    mode: 'create' | 'saveAs';
    name: string;
    level: EducationLevel;
    baseSource: 'current' | 'preset';
  }>({
    open: false,
    mode: 'create',
    name: '',
    level: 'มัธยมศึกษาตอนต้น',
    baseSource: 'current',
  });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    side: 'front' | 'back';
    id: string;
    name: string;
    isDefault?: boolean;
  } | null>(null);

  // Generic Action Confirmation Modal (discard changes / reset)
  const [actionConfirm, setActionConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const runWithDiscardCheck = (action: () => void) => {
    if (!hasChanges) {
      action();
      return;
    }
    setActionConfirm({
      title: 'มีการแก้ไขที่ยังไม่ได้บันทึก',
      message: 'คุณมีการแก้ไขรูปแบบบัตรที่ยังไม่ได้บันทึก ต้องการดำเนินการต่อโดยไม่บันทึกการแก้ไขนี้หรือไม่?',
      confirmLabel: 'ดำเนินการต่อโดยไม่บันทึก',
      onConfirm: () => {
        setActionConfirm(null);
        action();
      },
    });
  };

  const handleSideSwitch = (side: 'front' | 'back') => {
    if (side === designSide) return;
    runWithDiscardCheck(() => {
      setDesignSide(side);
      setHasChanges(false);
    });
  };

  // --- FRONT TEMPLATE ACTIONS ---
  const handleSelectFrontTemplate = (template: CardDesignConfig) => {
    if (template.id === currentFront.id) return;
    runWithDiscardCheck(() => {
      setCurrentFront(template);
      setHasChanges(false);
    });
  };

  const updateFrontField = <K extends keyof CardDesignConfig>(
    key: K,
    value: CardDesignConfig[K]
  ) => {
    setCurrentFront((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateElementStyle = (
    key: EditableElementKey,
    property: keyof CardElementStyle,
    value: any
  ) => {
    setCurrentFront((prev) => {
      const el = { ...prev.elements[key], [property]: value };
      return {
        ...prev,
        elements: {
          ...prev.elements,
          [key]: el,
        },
      };
    });
    setHasChanges(true);
  };

  const patchElementStyle = (
    key: EditableElementKey,
    patch: Partial<CardElementStyle>
  ) => {
    setCurrentFront((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [key]: { ...prev.elements[key], ...patch },
      },
    }));
    setHasChanges(true);
  };

  const handleSamplePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const uploaded = await storageService.uploadSamplePhoto(file);
      setSampleGuardianPhoto(uploaded.url);
      onNotify(
        `บีบอัดและอัปโหลดรูปตัวอย่างสำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)})`,
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

  const handleSelectGuardianSample = (guardianId: string) => {
    const g = guardians.find((item) => item.id === guardianId);
    if (!g) return;
    storageService.saveDesignerSamplePhoto(
      g.photoUrl,
      g.photoStoragePath || '',
      g.photoAssetId || ''
    );
    setSampleGuardianPhoto(storageService.resolveImageSrc(g.photoUrl, g.photoAssetId));
    onNotify('เปลี่ยนรูปตัวอย่างผู้ปกครองเรียบร้อยแล้ว', 'success');
  };

  const handleClearSamplePhoto = () => {
    setSampleGuardianPhoto('');
    storageService.saveDesignerSamplePhoto(null);
    onNotify('กลับไปใช้รูปตัวอย่างเริ่มต้นของระบบแล้ว', 'info');
  };

  const handleFrontBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const uploaded = await storageService.uploadCardDesignImage(file, 'front', currentFront.id);
      setCurrentFront((prev) => ({
        ...prev,
        bgImageUrl: uploaded.url,
        bgImageStoragePath: uploaded.storagePath,
        bgImageAssetId: uploaded.assetId,
        bgType: 'custom',
      }));
      setHasChanges(true);
      onNotify(
        `บีบอัดและบันทึกรูปพื้นหลังหน้าบัตรลง Firebase สำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)}) กรุณากดบันทึกเพื่ออัปเดตแม่แบบ`,
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

  const handleSaveFront = () => {
    if (!currentFront.name?.trim()) {
      onNotify('กรุณาระบุชื่อรูปแบบบัตรก่อนบันทึก', 'error');
      return;
    }
    const updated = storageService.saveFrontDesign(currentFront);
    setFrontDesigns(updated);
    const saved = updated.find((d) => d.id === currentFront.id);
    if (saved) setCurrentFront(saved);
    setHasChanges(false);
    onNotify(`บันทึกรูปแบบหน้าบัตร "${currentFront.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleSetDefaultFront = (id: string) => {
    const updated = storageService.setDefaultFrontDesign(id);
    setFrontDesigns(updated);
    const refreshed = updated.find((d) => d.id === currentFront.id);
    if (refreshed) setCurrentFront(refreshed);
    const target = updated.find((d) => d.id === id);
    onNotify(
      `ตั้ง "${target?.name}" เป็นรูปแบบเริ่มต้นสำหรับ ${target?.level} แล้ว`,
      'success'
    );
  };

  const handleDuplicateFront = (template: CardDesignConfig) => {
    const copy: CardDesignConfig = {
      ...JSON.parse(JSON.stringify(template)),
      id: `design_front_${Date.now()}`,
      name: `${template.name || template.title} (สำเนา)`,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveFrontDesign(copy);
    setFrontDesigns(updated);
    setCurrentFront(copy);
    setHasChanges(false);
    onNotify(`คัดลอกสร้างรูปแบบใหม่ "${copy.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleDeleteFront = (template: CardDesignConfig) => {
    if (frontDesigns.length <= 1) {
      onNotify('ต้องมีรูปแบบหน้าบัตรอย่างน้อย 1 รูปแบบในระบบ', 'error');
      return;
    }
    setDeleteModal({
      side: 'front',
      id: template.id,
      name: template.name || template.title,
      isDefault: template.isDefault,
    });
  };

  const handleResetFront = () => {
    setActionConfirm({
      title: 'รีเซ็ตรูปแบบหน้าบัตร',
      message: `ต้องการรีเซ็ตการตั้งค่าของรูปแบบหน้าบัตร "${currentFront.name || currentFront.title}" กลับเป็นค่าเริ่มต้นของระบบใช่หรือไม่?`,
      confirmLabel: 'ยืนยันรีเซ็ต',
      onConfirm: () => {
        const base =
          currentFront.level === 'มัธยมศึกษาตอนต้น'
            ? DEFAULT_JUNIOR_DESIGN
            : DEFAULT_SENIOR_DESIGN;
        const resetDesign: CardDesignConfig = {
          ...JSON.parse(JSON.stringify(base)),
          id: currentFront.id,
          name: currentFront.name,
          isDefault: currentFront.isDefault,
        };
        const updated = storageService.saveFrontDesign(resetDesign);
        setFrontDesigns(updated);
        setCurrentFront(resetDesign);
        setHasChanges(false);
        setActionConfirm(null);
        onNotify('รีเซ็ตรูปแบบหน้าบัตรกลับเป็นค่าเริ่มต้นแล้ว', 'info');
      },
    });
  };

  // --- BACK TEMPLATE ACTIONS ---
  const handleSelectBackTemplate = (template: BackCardDesignConfig) => {
    if (template.id === currentBack.id) return;
    runWithDiscardCheck(() => {
      setCurrentBack(template);
      setHasChanges(false);
    });
  };

  const updateBackDesign = (patch: Partial<BackCardDesignConfig>) => {
    setCurrentBack((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const handleBackBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const uploaded = await storageService.uploadCardDesignImage(file, 'back', currentBack.id);
      updateBackDesign({
        bgImageUrl: uploaded.url,
        bgImageStoragePath: uploaded.storagePath,
        bgImageAssetId: uploaded.assetId,
      });
      onNotify(
        `บีบอัดและบันทึกรูปพื้นหลังหลังบัตรลง Firebase สำเร็จ (${formatFileSize(uploaded.originalSize)} → ${formatFileSize(uploaded.compressedSize)})`,
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

  const handleSaveBack = () => {
    if (!currentBack.name?.trim()) {
      onNotify('กรุณาระบุชื่อรูปแบบหลังบัตรก่อนบันทึก', 'error');
      return;
    }
    const updated = storageService.saveBackDesign(currentBack);
    setBackDesigns(updated);
    const saved = updated.find((d) => d.id === currentBack.id);
    if (saved) setCurrentBack(saved);
    setHasChanges(false);
    onNotify(`บันทึกรูปแบบหลังบัตร "${currentBack.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleSetDefaultBack = (id: string) => {
    const updated = storageService.setDefaultBackDesign(id);
    setBackDesigns(updated);
    const refreshed = updated.find((d) => d.id === currentBack.id);
    if (refreshed) setCurrentBack(refreshed);
    const target = updated.find((d) => d.id === id);
    onNotify(`ตั้ง "${target?.name}" เป็นแบบหลังบัตรเริ่มต้นแล้ว`, 'success');
  };

  const handleDuplicateBack = (template: BackCardDesignConfig) => {
    const copy: BackCardDesignConfig = {
      ...JSON.parse(JSON.stringify(template)),
      id: `design_back_${Date.now()}`,
      name: `${template.name || template.title} (สำเนา)`,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const updated = storageService.saveBackDesign(copy);
    setBackDesigns(updated);
    setCurrentBack(copy);
    setHasChanges(false);
    onNotify(`คัดลอกสร้างรูปแบบหลังบัตรใหม่ "${copy.name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleDeleteBack = (template: BackCardDesignConfig) => {
    if (backDesigns.length <= 1) {
      onNotify('ต้องมีรูปแบบหลังบัตรอย่างน้อย 1 รูปแบบในระบบ', 'error');
      return;
    }
    setDeleteModal({
      side: 'back',
      id: template.id,
      name: template.name || template.title,
      isDefault: template.isDefault,
    });
  };

  const handleConfirmDeleteTemplate = () => {
    if (!deleteModal) return;
    if (deleteModal.side === 'front') {
      const remaining = storageService.deleteFrontDesign(deleteModal.id);
      setFrontDesigns(remaining);
      if (currentFront.id === deleteModal.id && remaining.length > 0) {
        setCurrentFront(remaining[0]);
        setHasChanges(false);
      }
      onNotify(`ลบรูปแบบหน้าบัตร "${deleteModal.name}" เรียบร้อยแล้ว`, 'success');
    } else {
      const remaining = storageService.deleteBackDesign(deleteModal.id);
      setBackDesigns(remaining);
      if (currentBack.id === deleteModal.id && remaining.length > 0) {
        setCurrentBack(remaining[0]);
        setHasChanges(false);
      }
      onNotify(`ลบรูปแบบหลังบัตร "${deleteModal.name}" เรียบร้อยแล้ว`, 'success');
    }
    setDeleteModal(null);
  };

  const handleResetBack = () => {
    setActionConfirm({
      title: 'รีเซ็ตรูปแบบหลังบัตร',
      message: `ต้องการรีเซ็ตการตั้งค่าของรูปแบบหลังบัตร "${currentBack.name || currentBack.title}" กลับเป็นค่าเริ่มต้นใช่หรือไม่?`,
      confirmLabel: 'ยืนยันรีเซ็ต',
      onConfirm: () => {
        const resetDesign: BackCardDesignConfig = {
          ...JSON.parse(JSON.stringify(DEFAULT_BACK_CARD_DESIGN)),
          id: currentBack.id,
          name: currentBack.name,
          isDefault: currentBack.isDefault,
        };
        const updated = storageService.saveBackDesign(resetDesign);
        setBackDesigns(updated);
        setCurrentBack(resetDesign);
        setHasChanges(false);
        setActionConfirm(null);
        onNotify('รีเซ็ตรูปแบบหลังบัตรกลับเป็นค่าเริ่มต้นแล้ว', 'info');
      },
    });
  };

  // --- CREATE / SAVE AS NEW MODAL SUBMIT ---
  const openCreateModal = (mode: 'create' | 'saveAs') => {
    const launchModal = () => {
      if (designSide === 'front') {
        setTemplateModal({
          open: true,
          mode,
          name:
            mode === 'saveAs'
              ? `${currentFront.name || 'รูปแบบหน้าบัตร'} (ใหม่)`
              : `รูปแบบหน้าบัตรใหม่ ${frontDesigns.length + 1}`,
          level: currentFront.level,
          baseSource: mode === 'saveAs' ? 'current' : 'preset',
        });
      } else {
        setTemplateModal({
          open: true,
          mode,
          name:
            mode === 'saveAs'
              ? `${currentBack.name || 'รูปแบบหลังบัตร'} (ใหม่)`
              : `รูปแบบหลังบัตรใหม่ ${backDesigns.length + 1}`,
          level: 'มัธยมศึกษาตอนต้น',
          baseSource: mode === 'saveAs' ? 'current' : 'preset',
        });
      }
    };

    if (mode === 'create') {
      runWithDiscardCheck(launchModal);
    } else {
      launchModal();
    }
  };

  const handleConfirmTemplateModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = templateModal.name.trim();
    if (!trimmedName) {
      onNotify('กรุณากรอกชื่อรูปแบบบัตร', 'error');
      return;
    }

    if (designSide === 'front') {
      const baseDesign =
        templateModal.baseSource === 'current'
          ? currentFront
          : templateModal.level === 'มัธยมศึกษาตอนต้น'
          ? DEFAULT_JUNIOR_DESIGN
          : DEFAULT_SENIOR_DESIGN;

      const newTemplate: CardDesignConfig = {
        ...JSON.parse(JSON.stringify(baseDesign)),
        id: `design_front_${Date.now()}`,
        name: trimmedName,
        level: templateModal.level,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      };
      const updated = storageService.saveFrontDesign(newTemplate);
      setFrontDesigns(updated);
      setCurrentFront(newTemplate);
      setHasChanges(false);
      setTemplateModal((m) => ({ ...m, open: false }));
      onNotify(`บันทึกรูปแบบหน้าบัตรใหม่ "${trimmedName}" เรียบร้อยแล้ว`, 'success');
    } else {
      const baseDesign =
        templateModal.baseSource === 'current' ? currentBack : DEFAULT_BACK_CARD_DESIGN;

      const newTemplate: BackCardDesignConfig = {
        ...JSON.parse(JSON.stringify(baseDesign)),
        id: `design_back_${Date.now()}`,
        name: trimmedName,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      };
      const updated = storageService.saveBackDesign(newTemplate);
      setBackDesigns(updated);
      setCurrentBack(newTemplate);
      setHasChanges(false);
      setTemplateModal((m) => ({ ...m, open: false }));
      onNotify(`บันทึกรูปแบบหลังบัตรใหม่ "${trimmedName}" เรียบร้อยแล้ว`, 'success');
    }
  };

  const selectedElement = currentFront.elements[selectedKey];
  const selectedMeta = ELEMENT_METAS.find((m) => m.key === selectedKey);

  return (
    <div className="space-y-5">
      {/* Header Bar: Title + Front/Back Mode Switcher + Save Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            ตัวออกแบบบัตรและคลังรูปแบบบัตร (Card Designer Studio)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            สร้างและบันทึกการออกแบบได้หลายรูปแบบทั้งหน้าบัตรและหลังบัตร เพื่อเลือกใช้งานได้ทันทีเมื่อสั่งพิมพ์ลงถาด PVC
          </p>
        </div>

        {/* Front / Back Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleSideSwitch('front')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                designSide === 'front'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              หน้าบัตร ({frontDesigns.length} แบบ)
            </button>
            <button
              type="button"
              onClick={() => handleSideSwitch('back')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                designSide === 'back'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              หลังบัตร ({backDesigns.length} แบบ)
            </button>
          </div>
        </div>
      </div>

      {/* Saved Templates Library Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              {designSide === 'front'
                ? `รายการรูปแบบหน้าบัตรที่บันทึกไว้ (${frontDesigns.length} รูปแบบ)`
                : `รายการรูปแบบหลังบัตรที่บันทึกไว้ (${backDesigns.length} รูปแบบ)`}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 font-sarabun">
              คลิกเลือกรูปแบบเพื่อแก้ไข หรือกด "+ สร้างรูปแบบใหม่" เพื่อบันทึกเพิ่มเป็นหลายแบบ
            </p>
          </div>

          <button
            type="button"
            onClick={() => openCreateModal('create')}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              designSide === 'front'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            สร้างรูปแบบ{designSide === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}ใหม่
          </button>
        </div>

        {/* Templates Grid */}
        {designSide === 'front' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {frontDesigns.map((tpl) => {
              const isSelected = tpl.id === currentFront.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectFrontTemplate(tpl)}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-200 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:border-blue-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
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
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {tpl.name || tpl.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate font-sarabun mt-0.5">
                        {tpl.title}
                      </div>
                    </div>
                  </div>

                  {/* Card Mini Actions */}
                  <div
                    className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!tpl.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultFront(tpl.id)}
                        className="text-slate-500 hover:text-amber-600 flex items-center gap-1 font-medium cursor-pointer"
                        title={`ตั้งเป็นค่าเริ่มต้นสำหรับ ${tpl.level}`}
                      >
                        <Star className="w-3 h-3" />
                        <span>ตั้งเป็นหลัก</span>
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        รูปแบบหลัก
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectFrontTemplate(tpl)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                        }`}
                        title="แก้ไขรูปแบบหน้าบัตรนี้"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{isSelected ? 'กำลังแก้ไข' : 'แก้ไข'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateFront(tpl)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="ทำสำเนารูปแบบนี้"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {frontDesigns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteFront(tpl)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบรูปแบบนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {backDesigns.map((tpl) => {
              const isSelected = tpl.id === currentBack.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectBackTemplate(tpl)}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tpl.displayMode === 'imageOnly'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {tpl.displayMode === 'imageOnly' ? 'ภาพเต็มใบ' : 'เทมเพลต'}
                      </span>
                      {tpl.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {tpl.name || tpl.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-sarabun mt-0.5">
                      {tpl.displayMode === 'imageOnly'
                        ? tpl.bgImageUrl
                          ? 'ภาพพื้นหลังเต็มใบ CR80'
                          : 'ยังไม่อัปโหลดภาพ'
                        : tpl.title}
                    </div>
                  </div>

                  {/* Card Mini Actions */}
                  <div
                    className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!tpl.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultBack(tpl.id)}
                        className="text-slate-500 hover:text-amber-600 flex items-center gap-1 font-medium cursor-pointer"
                        title="ตั้งเป็นแบบหลังบัตรเริ่มต้น"
                      >
                        <Star className="w-3 h-3" />
                        <span>ตั้งเป็นหลัก</span>
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        รูปแบบหลัก
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectBackTemplate(tpl)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                        }`}
                        title="แก้ไขรูปแบบหลังบัตรนี้"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{isSelected ? 'กำลังแก้ไข' : 'แก้ไข'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateBack(tpl)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="ทำสำเนารูปแบบนี้"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {backDesigns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBack(tpl)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบรูปแบบนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Template Metadata & Save Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              ชื่อรูปแบบบัตรที่กำลังแก้ไข
            </label>
            <input
              type="text"
              value={designSide === 'front' ? currentFront.name || '' : currentBack.name || ''}
              onChange={(e) =>
                designSide === 'front'
                  ? updateFrontField('name', e.target.value)
                  : updateBackDesign({ name: e.target.value })
              }
              placeholder="ตั้งชื่อรูปแบบบัตร เช่น แบบมาตรฐาน ปี 2569"
              className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {designSide === 'front' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ระดับชั้นแนะนำของรูปแบบนี้
                </label>
                <select
                  value={currentFront.level}
                  onChange={(e) =>
                    updateFrontField('level', e.target.value as EducationLevel)
                  }
                  className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น (ม.1 - ม.3)</option>
                  <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย (ม.4 - ม.6)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  หัวข้อบัตร (Title บนหน้าบัตร)
                </label>
                <input
                  type="text"
                  value={currentFront.title}
                  onChange={(e) => updateFrontField('title', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {(designSide === 'front' ? frontDesigns.length > 1 : backDesigns.length > 1) && (
            <button
              type="button"
              onClick={() =>
                designSide === 'front'
                  ? handleDeleteFront(currentFront)
                  : handleDeleteBack(currentBack)
              }
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ลบรูปแบบบัตรที่กำลังแก้ไขนี้"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ลบรูปแบบนี้
            </button>
          )}

          <button
            type="button"
            onClick={designSide === 'front' ? handleResetFront : handleResetBack}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="รีเซ็ตเป็นค่าเริ่มต้น"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            รีเซ็ต
          </button>

          <button
            type="button"
            onClick={() => openCreateModal('saveAs')}
            className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            บันทึกเป็นแบบใหม่
          </button>

          <button
            type="button"
            onClick={designSide === 'front' ? handleSaveFront : handleSaveBack}
            disabled={!hasChanges}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs ${
              hasChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            บันทึกทับรูปแบบนี้
          </button>
        </div>
      </div>

      {/* ==================== FRONT CARD EDITOR ==================== */}
      {designSide === 'front' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Card Canvas Preview */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                ตัวอย่างหน้าบัตรจริง (Real-time CR80 Preview)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">มาตราส่วน:</span>
                <div className="inline-flex text-xs bg-slate-100 rounded-md p-0.5">
                  {[1.0, 1.3, 1.5, 1.8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewScale(s)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        previewScale === s
                          ? 'bg-white shadow-xs text-blue-600 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Card Canvas Wrapper */}
            <div className="w-full flex justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 overflow-x-auto">
              <CardPreview
                design={currentFront}
                samplePhotoUrl={sampleGuardianPhoto || undefined}
                scale={previewScale}
                showBleedGuide={true}
              />
            </div>

            {/* Subtitle & Background Settings */}
            <div className="w-full mt-5 pt-4 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ชื่อสถานศึกษา / คำอธิบายรอง (Subtitle บนหน้าบัตร)
                </label>
                <input
                  type="text"
                  value={currentFront.subtitle}
                  onChange={(e) => updateFrontField('subtitle', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono font-medium">
                    85.6 mm × 54.0 mm (CR80)
                  </span>
                  <span>เส้นประสีแดง = ขอบตัดตก (Bleed Guide)</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentFront.bgType === 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        const defBg =
                          currentFront.level === 'มัธยมศึกษาตอนต้น'
                            ? DEFAULT_JUNIOR_HIGH_BG
                            : DEFAULT_SENIOR_HIGH_BG;
                        setCurrentFront((prev) => ({
                          ...prev,
                          bgImageUrl: defBg,
                          bgImageStoragePath: '',
                          bgImageAssetId: '',
                          bgType: 'preset',
                        }));
                        setHasChanges(true);
                        onNotify('ใช้ภาพพื้นหลังเริ่มต้นของระบบแล้ว', 'info');
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      ใช้ภาพเริ่มต้น
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setImagePickerTarget('frontBg')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer text-xs"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>คลังรูป Firebase</span>
                  </button>

                  <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-colors border border-blue-200 ${isUploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? 'กำลังบีบอัดและอัปโหลด...' : 'อัปโหลดภาพพื้นหลัง .PNG'}</span>
                    <input
                      type="file"
                      accept=".png,image/png,image/*"
                      disabled={isUploadingImage}
                      onChange={handleFrontBgUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* PNG Layer Order Setting Box */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 text-blue-900">
                    <Layers className="w-4 h-4 text-blue-600" />
                    ลำดับเลเยอร์ภาพพื้นหลัง .PNG (Background Layering Order)
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    {currentFront.bgLayerAbovePhoto !== false
                      ? 'พื้นหลัง .PNG อยู่ก่อน (รูปผู้ปกครองอยู่ใต้)'
                      : 'รูปผู้ปกครองอยู่บนพื้นหลัง'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      currentFront.bgLayerAbovePhoto !== false
                        ? 'bg-white border-blue-400 shadow-2xs font-semibold text-blue-900 ring-1 ring-blue-300'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bgLayerAbovePhoto"
                      checked={currentFront.bgLayerAbovePhoto !== false}
                      onChange={() => {
                        setCurrentFront((prev) => ({ ...prev, bgLayerAbovePhoto: true }));
                        setHasChanges(true);
                      }}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-bold text-slate-800">
                        รูปภาพพื้นหลัง .PNG อยู่ก่อน (รูปผู้ปกครองอยู่ใต้)
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal leading-relaxed mt-0.5 font-sarabun">
                        แนะนำสำหรับไฟล์ .PNG ที่ทำช่องกรอบเจาะรูโปร่งใส เพื่อให้ขอบกรอบรูปซ้อนทับภาพถ่ายผู้ปกครองได้อย่างเรียบเนียน
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      currentFront.bgLayerAbovePhoto === false
                        ? 'bg-white border-blue-400 shadow-2xs font-semibold text-blue-900 ring-1 ring-blue-300'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bgLayerAbovePhoto"
                      checked={currentFront.bgLayerAbovePhoto === false}
                      onChange={() => {
                        setCurrentFront((prev) => ({ ...prev, bgLayerAbovePhoto: false }));
                        setHasChanges(true);
                      }}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-bold text-slate-800">
                        รูปถ่ายผู้ปกครองอยู่บนรูปภาพพื้นหลัง
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal leading-relaxed mt-0.5 font-sarabun">
                        โหมดมาตรฐานสำหรับรูปพื้นหลังทึบที่ไม่มีการเจาะรู
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Element Selector & Precision Control Panel */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                เลือกองค์ประกอบที่ต้องการปรับแต่ง
              </h3>
              <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                หน่วยมิลลิเมตร (mm)
              </span>
            </div>

            <div>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value as EditableElementKey)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ELEMENT_METAS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedElement && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-medium text-slate-700">
                    แสดงผลองค์ประกอบนี้บนบัตร
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.visible}
                      onChange={(e) =>
                        updateElementStyle(selectedKey, 'visible', e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Coordinates X, Y */}
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-blue-600" />
                      พิกัดตำแหน่ง (Coordinates)
                    </span>
                    <span className="text-[11px] text-slate-400">จากมุมซ้ายบนของบัตร</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        พิกัด X (แนวนอน): {selectedElement.x.toFixed(1)} mm
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="0.5"
                        value={selectedElement.x}
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'x', parseFloat(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="85.6"
                        value={selectedElement.x}
                        onChange={(e) =>
                          updateElementStyle(
                            selectedKey,
                            'x',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        พิกัด Y (แนวตั้ง): {selectedElement.y.toFixed(1)} mm
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="0.5"
                        value={selectedElement.y}
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'y', parseFloat(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="54.0"
                        value={selectedElement.y}
                        onChange={(e) =>
                          updateElementStyle(
                            selectedKey,
                            'y',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {selectedMeta?.isImageOrBox && (
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      ขนาดกรอบรูปภาพและความโค้งมน
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          ความกว้าง (Width mm)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="50"
                          value={selectedElement.width || 25}
                          onChange={(e) =>
                            updateElementStyle(
                              selectedKey,
                              'width',
                              parseFloat(e.target.value) || 25
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          ความสูง (Height mm)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="50"
                          value={selectedElement.height || 29}
                          onChange={(e) =>
                            updateElementStyle(
                              selectedKey,
                              'height',
                              parseFloat(e.target.value) || 29
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                    </div>

                    {selectedKey === 'guardianPhoto' && (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              มุมโค้งมน (px)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={selectedElement.borderRadius ?? 4}
                              onChange={(e) =>
                                updateElementStyle(
                                  selectedKey,
                                  'borderRadius',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              ความหนาขอบ (px)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="8"
                              step="0.5"
                              value={selectedElement.borderWidth ?? 1.5}
                              onChange={(e) =>
                                updateElementStyle(
                                  selectedKey,
                                  'borderWidth',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              สีกรอบรูป
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={selectedElement.borderColor || '#ffffff'}
                                onChange={(e) =>
                                  updateElementStyle(selectedKey, 'borderColor', e.target.value)
                                }
                                className="w-7 h-7 rounded border border-slate-300 cursor-pointer shrink-0"
                              />
                              <span className="text-[10px] font-mono truncate">
                                {selectedElement.borderColor || '#ffffff'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sample Guardian Photo Upload & Picker */}
                        <div className="p-3 bg-white rounded-xl border border-blue-200/80 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-800">
                              รูปถ่ายตัวอย่างผู้ปกครอง (ใช้ทดสอบบนหน้าบัตร)
                            </span>
                            {sampleGuardianPhoto && (
                              <button
                                type="button"
                                onClick={handleClearSamplePhoto}
                                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                              >
                                ใช้รูปเริ่มต้น
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                              {sampleGuardianPhoto ? (
                                <img
                                  src={sampleGuardianPhoto}
                                  alt="Sample Guardian"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-slate-300" />
                              )}
                            </div>

                            <div className="flex-1 space-y-1.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <label className="cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>อัปโหลดรูปตัวอย่าง</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSamplePhotoUpload}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setImagePickerTarget('samplePhoto')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-300 cursor-pointer"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                                  <span>คลังรูป</span>
                                </button>
                              </div>

                              {guardians.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSelectGuardianSample(e.target.value);
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">-- หรือเลือกจากผู้ปกครองในระบบ --</option>
                                  {guardians.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.prefix}
                                      {g.firstName} {g.lastName} ({g.relation})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Element-Specific Settings */}
                {(selectedKey === 'issueDate' || selectedKey === 'expiryDate') && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      รูปแบบวันที่ ({selectedKey === 'issueDate' ? 'วันที่ออกบัตร' : 'วันหมดอายุ'})
                    </span>

                    <div className="grid grid-cols-1 gap-1.5">
                      {(
                        [
                          {
                            value: 'full',
                            label: 'แบบเต็ม (เช่น 31 มีนาคม 2572)',
                          },
                          {
                            value: 'short',
                            label: 'แบบย่อ (เช่น 31 มี.ค. 2572)',
                          },
                          {
                            value: 'numeric',
                            label: 'ตัวเลข ว/ด/ป (เช่น 31/03/2572)',
                          },
                        ] as { value: CardDateFormat; label: string }[]
                      ).map((opt) => {
                        const active = (selectedElement.dateFormat || 'short') === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateElementStyle(selectedKey, 'dateFormat', opt.value)
                            }
                            className={`px-3 py-1.5 text-left text-xs rounded-lg border transition-colors cursor-pointer font-sarabun ${
                              active
                                ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        ข้อความนำหน้าวันที่ (เว้นว่างได้)
                      </label>
                      <input
                        type="text"
                        value={
                          selectedElement.prefixText !== undefined
                            ? selectedElement.prefixText
                            : selectedKey === 'issueDate'
                            ? 'ออกบัตร:'
                            : 'หมดอายุ:'
                        }
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'prefixText', e.target.value)
                        }
                        placeholder={selectedKey === 'issueDate' ? 'ออกบัตร:' : 'หมดอายุ:'}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {selectedKey === 'studentId' && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      ตั้งค่าการแสดงผลเลขประจำตัวนักเรียน 5 หลัก
                    </span>

                    <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                      <span className="text-xs font-medium text-slate-700">
                        แสดงเฉพาะตัวเลขเท่านั้น (ไม่ใส่ข้อความนำหน้า)
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedElement.numbersOnly)}
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'numbersOnly', e.target.checked)
                        }
                        className="rounded text-blue-600 w-4 h-4"
                      />
                    </label>

                    <div className={selectedElement.numbersOnly ? 'opacity-50' : ''}>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        ข้อความนำเลขรหัสนักเรียน
                      </label>
                      <input
                        type="text"
                        disabled={Boolean(selectedElement.numbersOnly)}
                        value={
                          selectedElement.prefixText !== undefined
                            ? selectedElement.prefixText
                            : 'รหัส:'
                        }
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'prefixText', e.target.value)
                        }
                        placeholder="เช่น รหัส:, รหัสนักเรียน:, ID:"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-blue-100">
                      <label className="block text-[11px] font-medium text-slate-600">
                        สีพื้นหลังตัวเลขรหัสนักเรียน
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateElementStyle(selectedKey, 'showBackground', true)
                          }
                          className={`py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                            selectedElement.showBackground !== false
                              ? 'bg-blue-600 text-white font-bold border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          ใส่สีพื้นหลัง
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateElementStyle(selectedKey, 'showBackground', false)
                          }
                          className={`py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                            selectedElement.showBackground === false
                              ? 'bg-blue-600 text-white font-bold border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          ไม่ใส่สีพื้นหลัง
                        </button>
                      </div>

                      {selectedElement.showBackground !== false && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              เลือกสีพื้นหลัง
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedElement.backgroundColor || '#000000'}
                                onChange={(e) =>
                                  patchElementStyle(selectedKey, {
                                    showBackground: true,
                                    backgroundColor: e.target.value,
                                  })
                                }
                                className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                              />
                              <span className="text-xs font-mono">
                                {selectedElement.backgroundColor || '#000000'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              ความทึบพื้นหลัง:{' '}
                              {Math.round(
                                (selectedElement.backgroundOpacity ?? 0.25) * 100
                              )}
                              %
                            </label>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.05"
                              value={selectedElement.backgroundOpacity ?? 0.25}
                              onChange={(e) =>
                                updateElementStyle(
                                  selectedKey,
                                  'backgroundOpacity',
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(selectedKey === 'guardianName' || selectedKey === 'studentName') && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      รูปแบบคำนำหน้าและการจัดบรรทัด (
                      {selectedKey === 'guardianName' ? 'ผู้ถือบัตร' : 'นักเรียน'})
                    </span>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-600">
                          ข้อความคำนำหน้า
                        </label>
                        {selectedKey === 'guardianName' && (
                          <div className="flex items-center gap-1">
                            {['ผู้ถือบัตร:', 'ผู้ปกครอง:'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  updateElementStyle(selectedKey, 'prefixText', preset)
                                }
                                className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded hover:bg-blue-50 text-slate-600 cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={
                          selectedElement.prefixText !== undefined
                            ? selectedElement.prefixText
                            : selectedKey === 'guardianName'
                            ? 'ผู้ถือบัตร:'
                            : 'นักเรียน:'
                        }
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'prefixText', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        การแสดงคำนำหน้า ({selectedKey === 'guardianName' ? 'ผู้ถือบัตร' : 'นักเรียน'})
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { value: 'inline', label: 'บรรทัดเดียวกัน' },
                            { value: 'newline', label: 'คนละบรรทัด' },
                            { value: 'hidden', label: 'ไม่แสดง' },
                          ] as { value: LabelLayoutMode; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateElementStyle(selectedKey, 'labelLayout', opt.value)
                            }
                            className={`py-1.5 px-1 text-[11px] rounded-lg border transition-colors cursor-pointer ${
                              (selectedElement.labelLayout || 'inline') === opt.value
                                ? 'bg-blue-600 text-white font-bold border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        ระยะห่างบรรทัด (Line Height):{' '}
                        {(selectedElement.lineHeight ?? 1.25).toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.8"
                        max="2.2"
                        step="0.05"
                        value={selectedElement.lineHeight ?? 1.25}
                        onChange={(e) =>
                          updateElementStyle(
                            selectedKey,
                            'lineHeight',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {selectedKey === 'guardianName' && (
                      <label className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <span className="text-[11px] font-medium text-slate-700">
                          แสดงความสัมพันธ์ เช่น (บิดา)
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedElement.showRelation !== false}
                          onChange={(e) =>
                            updateElementStyle(
                              selectedKey,
                              'showRelation',
                              e.target.checked
                            )
                          }
                          className="rounded text-blue-600 w-4 h-4"
                        />
                      </label>
                    )}
                  </div>
                )}

                {selectedKey === 'studentClass' && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      รูปแบบการแสดงระดับชั้น / ห้องเรียน
                    </span>

                    <div className="grid grid-cols-1 gap-1.5">
                      {(
                        [
                          {
                            value: 'short_m',
                            label: 'แสดงแบบสั้น: ชั้น ม.1/2 (ตัด ม.ต้น/ม.ปลาย ออก)',
                          },
                          {
                            value: 'custom_prefix',
                            label: 'พิมพ์ข้อความนำหน้า + เลขชั้น/ห้อง (เช่น ชั้น/ห้อง: ม.1/2)',
                          },
                          {
                            value: 'custom_text',
                            label: 'พิมพ์ข้อความ ชั้น/ห้อง กำหนดเอง',
                          },
                        ] as { value: ClassDisplayMode; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            updateElementStyle(selectedKey, 'classDisplayMode', opt.value)
                          }
                          className={`px-3 py-1.5 text-left text-xs rounded-lg border transition-colors cursor-pointer font-sarabun ${
                            (selectedElement.classDisplayMode || 'short_m') === opt.value
                              ? 'bg-blue-600 text-white font-bold border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {(selectedElement.classDisplayMode || 'short_m') === 'custom_prefix' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            ข้อความนำหน้าเลขชั้น/ห้อง
                          </label>
                          <div className="flex items-center gap-1 flex-wrap">
                            {['ชั้น ม.', 'ชั้น/ห้อง: ม.', 'ม.', ''].map((p) => (
                              <button
                                key={p || 'empty'}
                                type="button"
                                onClick={() =>
                                  updateElementStyle(selectedKey, 'prefixText', p)
                                }
                                className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded hover:bg-blue-50 text-slate-600 cursor-pointer"
                              >
                                {p === '' ? 'เฉพาะเลขห้อง' : p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={
                            selectedElement.prefixText !== undefined
                              ? selectedElement.prefixText
                              : 'ชั้น ม.'
                          }
                          onChange={(e) =>
                            updateElementStyle(selectedKey, 'prefixText', e.target.value)
                          }
                          placeholder="เช่น ชั้น ม., ชั้น/ห้อง: ม., ห้อง "
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {selectedElement.classDisplayMode === 'custom_text' && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          ข้อความ ชั้น/ห้อง ที่ต้องการแสดงบนบัตร
                        </label>
                        <input
                          type="text"
                          value={selectedElement.customText || ''}
                          onChange={(e) =>
                            updateElementStyle(selectedKey, 'customText', e.target.value)
                          }
                          placeholder="เช่น ชั้น ม.1/2 หรือ ชั้น/ห้อง 1/2"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {!selectedMeta?.isImageOrBox && (
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-blue-600" />
                      ฟอนต์ ขนาดตัวอักษร และสีข้อความ
                    </span>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        แบบอักษร (Font Family)
                      </label>
                      <select
                        value={
                          selectedElement.fontFamily ||
                          (selectedKey === 'studentId'
                            ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                            : selectedKey === 'title' || selectedKey === 'guardianName'
                            ? "'Prompt', sans-serif"
                            : "'Sarabun', sans-serif")
                        }
                        onChange={(e) =>
                          updateElementStyle(selectedKey, 'fontFamily', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CARD_FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          ขนาดตัวอักษร: {selectedElement.fontSize} pt
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="20"
                          step="0.5"
                          value={selectedElement.fontSize}
                          onChange={(e) =>
                            updateElementStyle(
                              selectedKey,
                              'fontSize',
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          สีข้อความ
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={selectedElement.color}
                            onChange={(e) =>
                              updateElementStyle(selectedKey, 'color', e.target.value)
                            }
                            className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                          />
                          <span className="text-xs font-mono">{selectedElement.color}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        น้ำหนักตัวอักษร
                      </label>
                      <div className="flex gap-2">
                        {(['normal', '600', 'bold'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateElementStyle(selectedKey, 'fontWeight', w)}
                            className={`flex-1 py-1 text-xs rounded border transition-colors cursor-pointer ${
                              selectedElement.fontWeight === w
                                ? 'bg-blue-600 text-white font-bold border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {w === 'normal' ? 'ปกติ' : w === '600' ? 'หนาปานกลาง' : 'ตัวหนา'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== BACK CARD EDITOR ==================== */}
      {designSide === 'back' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Back Card Canvas Preview */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-600" />
                ตัวอย่างหลังบัตรจริง (Real-time CR80 Preview)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewBackRotate180((v) => !v)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                    previewBackRotate180
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  หมุน 180°
                </button>
                <div className="inline-flex text-xs bg-slate-100 rounded-md p-0.5">
                  {[1.0, 1.3, 1.5, 1.8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewScale(s)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        previewScale === s
                          ? 'bg-white shadow-xs text-indigo-600 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full flex justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 overflow-x-auto">
              <BackCardPreview
                design={currentBack}
                scale={previewScale}
                showBleedGuide={true}
                rotate180={previewBackRotate180}
              />
            </div>

            <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono font-medium">
                85.6 mm × 54.0 mm (CR80)
              </span>
              <span className="font-sarabun text-[11px]">
                รูปแบบที่บันทึกไว้จะแสดงให้เลือกใช้ทันทีในหน้า "พิมพ์หลังบัตร"
              </span>
            </div>
          </div>

          {/* Right Column: Back Card Controls */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FlipHorizontal2 className="w-4 h-4 text-indigo-600" />
                ปรับแต่งข้อมูลและดีไซน์หลังบัตร
              </h3>
            </div>

            {/* Display Mode Switch */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => updateBackDesign({ displayMode: 'template' })}
                className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentBack.displayMode === 'template'
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
                  currentBack.displayMode === 'imageOnly'
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
                {currentBack.bgImageUrl
                  ? 'อัปโหลดภาพพื้นหลังแล้ว (ขนาด CR80)'
                  : currentBack.displayMode === 'imageOnly'
                  ? 'อัปโหลดไฟล์ภาพ .PNG / .JPG สำหรับหลังบัตรเต็มใบ'
                  : 'อัปโหลดภาพพื้นหลังเพิ่มเติมได้ (ไม่บังคับ)'}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentBack.bgImageUrl && (
                  <button
                    type="button"
                    onClick={() => updateBackDesign({ bgImageUrl: '', bgImageStoragePath: '', bgImageAssetId: '' })}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    ลบภาพ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImagePickerTarget('backBg')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>คลังรูป Firebase</span>
                </button>
                <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 transition-colors ${isUploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingImage ? 'กำลังบีบอัด...' : 'อัปโหลดภาพ .PNG/.JPG'}</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/*"
                    disabled={isUploadingImage}
                    onChange={handleBackBgUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {currentBack.displayMode === 'template' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    หัวข้อหลังบัตร
                  </label>
                  <input
                    type="text"
                    value={currentBack.title}
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
                    value={currentBack.subtitle}
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
                    value={currentBack.rules.join('\n')}
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
                      value={currentBack.emergencyLabel}
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
                      value={currentBack.emergencyPhone}
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
                    value={currentBack.footerNote}
                    onChange={(e) => updateBackDesign({ footerNote: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-sarabun"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      สีหัวข้อ/แถบ
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={currentBack.accentColor}
                        onChange={(e) =>
                          updateBackDesign({ accentColor: e.target.value })
                        }
                        className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-slate-600">
                        {currentBack.accentColor}
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
                        value={currentBack.bgColor}
                        onChange={(e) =>
                          updateBackDesign({ bgColor: e.target.value })
                        }
                        className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-slate-600">
                        {currentBack.bgColor}
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
                        value={currentBack.textColor}
                        onChange={(e) =>
                          updateBackDesign({ textColor: e.target.value })
                        }
                        className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-slate-600">
                        {currentBack.textColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentBack.showLogo}
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
                      checked={currentBack.showSignatureBox}
                      onChange={(e) =>
                        updateBackDesign({ showSignatureBox: e.target.checked })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>แสดงช่องลงนาม</span>
                  </label>
                </div>

                {currentBack.showSignatureBox && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      คำใต้เส้นลงนาม
                    </label>
                    <input
                      type="text"
                      value={currentBack.signatureLabel}
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
        </div>
      )}

      {/* ==================== CREATE / SAVE AS NEW MODAL ==================== */}
      {templateModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-blue-600" />
                {templateModal.mode === 'saveAs'
                  ? `บันทึกเป็นรูปแบบ${designSide === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}ใหม่`
                  : `สร้างรูปแบบ${designSide === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}ใหม่`}
              </h3>
              <button
                type="button"
                onClick={() => setTemplateModal((m) => ({ ...m, open: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTemplateModal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ชื่อรูปแบบบัตร <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={templateModal.name}
                  onChange={(e) =>
                    setTemplateModal((m) => ({ ...m, name: e.target.value }))
                  }
                  placeholder={
                    designSide === 'front'
                      ? 'เช่น บัตรรับส่ง ม.ต้น (รุ่นปี 2569)'
                      : 'เช่น หลังบัตรกิจกรรมพิเศษ'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {designSide === 'front' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ระดับชั้นแนะนำ
                  </label>
                  <select
                    value={templateModal.level}
                    onChange={(e) =>
                      setTemplateModal((m) => ({
                        ...m,
                        level: e.target.value as EducationLevel,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น (ม.1 - ม.3)</option>
                    <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย (ม.4 - ม.6)</option>
                  </select>
                </div>
              )}

              {templateModal.mode === 'create' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    ต้นแบบตั้งต้น
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                        templateModal.baseSource === 'preset'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="baseSource"
                        checked={templateModal.baseSource === 'preset'}
                        onChange={() =>
                          setTemplateModal((m) => ({ ...m, baseSource: 'preset' }))
                        }
                      />
                      <span>ค่าเริ่มต้นระบบ</span>
                    </label>
                    <label
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                        templateModal.baseSource === 'current'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="baseSource"
                        checked={templateModal.baseSource === 'current'}
                        onChange={() =>
                          setTemplateModal((m) => ({ ...m, baseSource: 'current' }))
                        }
                      />
                      <span>คัดลอกแบบปัจจุบัน</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTemplateModal((m) => ({ ...m, open: false }))}
                  className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  บันทึกรูปแบบใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE TEMPLATE CONFIRMATION MODAL ==================== */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    ยืนยันการลบแม่แบบ{deleteModal.side === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}
                  </h3>
                  <p className="text-xs text-slate-600 font-sarabun leading-relaxed">
                    คุณต้องการลบแม่แบบ{' '}
                    <strong className="text-slate-900">"{deleteModal.name}"</strong>{' '}
                    ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </p>
                  {deleteModal.isDefault && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-sarabun mt-2">
                      แม่แบบนี้อยู่ในสถานะค่าเริ่มต้น ระบบจะเลื่อนแม่แบบอื่นที่เหลือขึ้นมาเป็นค่าเริ่มต้นแทนโดยอัตโนมัติ
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTemplate}
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

      {/* ==================== ACTION CONFIRMATION MODAL ==================== */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">{actionConfirm.title}</h3>
                  <p className="text-xs text-slate-600 font-sarabun leading-relaxed">
                    {actionConfirm.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setActionConfirm(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={actionConfirm.onConfirm}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold cursor-pointer"
                >
                  {actionConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <FirebaseImagePickerModal
        isOpen={Boolean(imagePickerTarget)}
        onClose={() => setImagePickerTarget(null)}
        initialCategory={
          imagePickerTarget === 'frontBg'
            ? 'front_bg'
            : imagePickerTarget === 'backBg'
            ? 'back_bg'
            : imagePickerTarget === 'samplePhoto'
            ? 'sample_photo'
            : 'all'
        }
        title={
          imagePickerTarget === 'frontBg'
            ? 'เลือกภาพพื้นหลังหน้าบัตรจากฐานข้อมูล Firebase'
            : imagePickerTarget === 'backBg'
            ? 'เลือกภาพพื้นหลังหลังบัตรจากฐานข้อมูล Firebase'
            : 'เลือกรูปตัวอย่างผู้ปกครองจากฐานข้อมูล Firebase'
        }
        onNotify={onNotify}
        onSelect={(asset: ImageAsset) => {
          const refUrl = asset.storageUrl || `firestore-asset://${asset.id}`;
          if (imagePickerTarget === 'frontBg') {
            setCurrentFront((prev) => ({
              ...prev,
              bgImageUrl: refUrl,
              bgImageStoragePath: asset.storagePath || '',
              bgImageAssetId: asset.id,
              bgType: 'custom',
            }));
            setHasChanges(true);
            onNotify(`เลือกภาพ "${asset.fileName}" จาก Firebase แล้ว กรุณากดบันทึกเพื่ออัปเดตแม่แบบ`, 'success');
          } else if (imagePickerTarget === 'backBg') {
            updateBackDesign({
              bgImageUrl: refUrl,
              bgImageStoragePath: asset.storagePath || '',
              bgImageAssetId: asset.id,
            });
            onNotify(`เลือกภาพ "${asset.fileName}" จาก Firebase แล้ว กรุณากดบันทึกเพื่ออัปเดตแม่แบบ`, 'success');
          } else if (imagePickerTarget === 'samplePhoto') {
            storageService.saveDesignerSamplePhoto(refUrl, asset.storagePath || '', asset.id);
            setSampleGuardianPhoto(storageService.resolveImageSrc(refUrl, asset.id));
            onNotify(`บันทึกรูปตัวอย่าง "${asset.fileName}" ลง Firebase Settings แล้ว`, 'success');
          }
        }}
      />
    </div>
  );
};
