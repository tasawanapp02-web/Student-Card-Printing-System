import React, { useState, useEffect, useRef } from 'react';
import {
  PickupCard,
  Student,
  Guardian,
  TrayCalibrationConfig,
  UserAccount,
  PrintPreviewPayload,
} from '../types';
import { storageService } from '../utils/storage';
import { formatStudentGradeRoom, getCurrentBuddhistYear } from '../utils/thaiDate';
import { CardPreview } from './CardPreview';
import { TrayCalibrationPanel } from './TrayCalibrationPanel';
import { openPrintPreviewInNewTab } from '../utils/printPreview';
import { DEFAULT_TRAY_CONFIG } from '../utils/defaultData';
import {
  Printer,
  SlidersHorizontal,
  CheckCircle2,
  Search,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  Layers,
  RotateCw,
  Edit2,
} from 'lucide-react';

const PVC_FRONT_SLOTS_SESSION_KEY = 'spc_pvc_front_slots_v1';

interface PvcPrintViewProps {
  currentUser: UserAccount | null;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  reprintCardId?: string | null;
  reprintDesignId?: string | null;
  onReprintLoaded?: () => void;
  onEditCard?: (cardId: string) => void;
}

export const PvcPrintView: React.FC<PvcPrintViewProps> = ({
  currentUser,
  onNotify,
  reprintCardId,
  reprintDesignId,
  onReprintLoaded,
  onEditCard,
}) => {
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear() || getCurrentBuddhistYear()
  );
  const [trayConfig, setTrayConfig] = useState<TrayCalibrationConfig>(() =>
    storageService.getTrayConfig()
  );
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [frontDesigns, setFrontDesigns] = useState(() => storageService.getFrontDesigns());

  useEffect(() => {
    return storageService.subscribe(() => {
      setCurrentAcademicYear(storageService.getAcademicYear() || getCurrentBuddhistYear());
      setTrayConfig(storageService.getTrayConfig());
      setStudents(storageService.getStudents());
      setGuardians(storageService.getGuardians());
      setCards(storageService.getCards());
      setFrontDesigns(storageService.getFrontDesigns());
    });
  }, []);

  const readSavedSlots = (): { initialized: boolean; card1Id: string; card2Id: string } => {
    try {
      const raw = sessionStorage.getItem(PVC_FRONT_SLOTS_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.initialized) {
          return {
            initialized: true,
            card1Id: typeof parsed.card1Id === 'string' ? parsed.card1Id : '',
            card2Id: typeof parsed.card2Id === 'string' ? parsed.card2Id : '',
          };
        }
      }
    } catch {
      // ignore
    }
    return { initialized: false, card1Id: '', card2Id: '' };
  };

  const initialSlots = readSavedSlots();
  const hasInitializedSlotsRef = useRef<boolean>(initialSlots.initialized);

  const [card1Id, setCard1Id] = useState<string>(initialSlots.card1Id);
  const [card2Id, setCard2Id] = useState<string>(initialSlots.card2Id);
  const [overrideDesign1Id, setOverrideDesign1Id] = useState<string | null>(null);

  const [enableSlot1, setEnableSlot1] = useState<boolean>(true);
  const [enableSlot2, setEnableSlot2] = useState<boolean>(true);

  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [showTestPattern, setShowTestPattern] = useState<boolean>(false);
  const [blockedPreviewUrl, setBlockedPreviewUrl] = useState<string | null>(null);

  // Search selector modals
  const [activePickerSlot, setActivePickerSlot] = useState<1 | 2 | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Persist selected tray slots in sessionStorage across tab switches
  useEffect(() => {
    if (!hasInitializedSlotsRef.current) return;
    try {
      sessionStorage.setItem(
        PVC_FRONT_SLOTS_SESSION_KEY,
        JSON.stringify({ initialized: true, card1Id, card2Id })
      );
    } catch {
      // ignore
    }
  }, [card1Id, card2Id]);

  // Handle incoming Reprint / Send-to-tray request or initial pre-populate
  useEffect(() => {
    if (reprintCardId) {
      hasInitializedSlotsRef.current = true;
      setCard1Id(reprintCardId);
      setOverrideDesign1Id(reprintDesignId || null);
      setEnableSlot1(true);
      onNotify('ดึงข้อมูลบัตรสำหรับพิมพ์ซ้ำ (Reprint) ลงในถาดพิมพ์เรียบร้อยแล้ว', 'info');
      if (onReprintLoaded) {
        onReprintLoaded();
      }
    } else if (cards.length > 0 && !hasInitializedSlotsRef.current) {
      // Auto pre-populate initial slots once for quick testing
      hasInitializedSlotsRef.current = true;
      const firstCard = cards[0];
      setCard1Id(firstCard?.id || '');
      setOverrideDesign1Id(null);
      if (cards.length > 1) {
        const secondCard = cards[1];
        setCard2Id(secondCard?.id || '');
      }
    }
  }, [reprintCardId, reprintDesignId, cards]);

  const resolveDesignForCard = (
    card?: PickupCard,
    student?: Student,
    overrideDesignId?: string | null
  ) => {
    const candidateId = overrideDesignId || card?.frontDesignId;
    if (candidateId) {
      const matched = frontDesigns.find((d) => d.id === candidateId);
      if (matched) return matched;
    }
    return storageService.getCardDesign(student?.level || 'มัธยมศึกษาตอนต้น');
  };

  const card1 = cards.find((c) => c.id === card1Id);
  const student1 = card1 ? students.find((s) => s.studentId === card1.studentId) : undefined;
  const guardian1 = card1 ? guardians.find((g) => g.id === card1.guardianId) : undefined;
  const design1 = resolveDesignForCard(card1, student1, overrideDesign1Id);

  const card2 = cards.find((c) => c.id === card2Id);
  const student2 = card2 ? students.find((s) => s.studentId === card2.studentId) : undefined;
  const guardian2 = card2 ? guardians.find((g) => g.id === card2.guardianId) : undefined;
  const design2 = resolveDesignForCard(card2, student2);

  // Calibration save
  const handleSaveCalibration = () => {
    storageService.saveTrayConfig(trayConfig);
    onNotify(`บันทึกพิกัดและขนาดถาดพิมพ์ (${trayConfig.trayWidthMm} × ${trayConfig.trayHeightMm} มม.) ใช้ร่วมกันทั้งหน้าและหลังบัตรเรียบร้อยแล้ว`, 'success');
    setIsCalibrating(false);
  };

  const handleResetCalibration = () => {
    if (confirm('ต้องการรีเซ็ตพิกัดและขนาดถาดพิมพ์กลับเป็นค่ามาตรฐาน EPSON L850 (130 × 220 มม.) หรือไม่?')) {
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

  // Duplicate Slot 1 into Slot 2
  const handleDuplicateSlot1 = () => {
    if (!card1Id) {
      onNotify('กรุณาเลือกบัตรในช่องที่ 1 ก่อนคัดลอก', 'error');
      return;
    }
    setCard2Id(card1Id);
    setEnableSlot2(true);
    onNotify('คัดลอกบัตรช่องที่ 1 ไปยังช่องที่ 2 เรียบร้อยแล้ว', 'success');
  };

  // Open Print Preview in a New Tab
  const handlePrint = () => {
    if (!enableSlot1 && !enableSlot2) {
      onNotify('กรุณาเปิดใช้งานอย่างน้อย 1 ช่องบัตรบนถาดพิมพ์', 'error');
      return;
    }

    const hasSlot1Card = enableSlot1 && Boolean(card1);
    const hasSlot2Card = enableSlot2 && Boolean(card2);

    if (!hasSlot1Card && !hasSlot2Card) {
      onNotify('กรุณาเลือกบัตรรับส่งนักเรียนอย่างน้อย 1 ช่องที่เปิดพิมพ์', 'error');
      return;
    }

    storageService.saveTrayConfig(trayConfig);

    const payload: PrintPreviewPayload = {
      id: `prev_front_${Date.now()}`,
      createdAt: new Date().toISOString(),
      side: 'front',
      trayConfig,
      enableSlot1: hasSlot1Card,
      enableSlot2: hasSlot2Card,
      slot1CardId: hasSlot1Card ? card1!.id : undefined,
      slot2CardId: hasSlot2Card ? card2!.id : undefined,
      slot1DesignId: hasSlot1Card ? design1.id : undefined,
      slot2DesignId: hasSlot2Card ? design2.id : undefined,
      operatorName: currentUser?.fullName || 'เจ้าหน้าที่ผู้พิมพ์',
    };

    const result = openPrintPreviewInNewTab(payload);
    if (result.opened) {
      onNotify('เปิดหน้าตัวอย่างการพิมพ์ในแท็บใหม่เรียบร้อยแล้ว', 'success');
    } else {
      setBlockedPreviewUrl(result.url);
      onNotify('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณากดปุ่มเปิดแท็บตัวอย่างด้านล่าง', 'info');
    }
  };

  // Filtered Cards for Card Selector Modal
  const filteredCards = cards.filter((c) => {
    const s = students.find((st) => st.studentId === c.studentId);
    const g = guardians.find((gd) => gd.id === c.guardianId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.studentId.includes(q) ||
      s?.firstName.toLowerCase().includes(q) ||
      s?.lastName.toLowerCase().includes(q) ||
      s?.nickname.toLowerCase().includes(q) ||
      s?.classroom.toLowerCase().includes(q) ||
      (s ? formatStudentGradeRoom(s, currentAcademicYear).toLowerCase().includes(q) : false) ||
      g?.firstName.toLowerCase().includes(q) ||
      g?.lastName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">

      {/* -------------------- SCREEN UI -------------------- */}
      {/* Top Banner */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            ระบบพิมพ์บัตรลงถาด PVC ({trayConfig.printerProfile || 'EPSON / Canon Series'})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            พิมพ์ 2 บัตร ต่อ 1 ถาดพิมพ์ (ขนาดถาด {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} มม. / บัตร {trayConfig.cardWidthMm} × {trayConfig.cardHeightMm} มม.) พร้อมระบบปรับพิกัดและขนาดถาดแม่นยำ
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 flex-wrap">
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
            {isCalibrating ? 'ปิดการตั้งค่าพิกัด/ขนาดถาด' : 'ตั้งค่าพิกัดและขนาดถาด (Calibration)'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            สั่งพิมพ์ลงถาด (แสดงตัวอย่างแท็บใหม่)
          </button>
        </div>
      </div>

      {/* Shared Calibration Drawer Panel */}
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

      {/* Main Grid: Left Slot Selectors, Right Tray Visual Preview */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Slot 1 & Slot 2 Card Pickers */}
        <div className="lg:col-span-5 space-y-5">
          {/* Slot 1 Box */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              enableSlot1
                ? 'bg-white border-blue-200 shadow-xs'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-bold text-slate-800">
                  บัตรใบที่ 1 (ถาดตำแหน่งบน)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSlot1}
                    onChange={(e) => setEnableSlot1(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>เปิดพิมพ์ช่องนี้</span>
                </label>
              </div>
            </div>

            {card1 && student1 && guardian1 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <img
                    src={storageService.resolveImageSrc(guardian1.photoUrl, guardian1.photoAssetId)}
                    alt={guardian1.firstName}
                    className="w-12 h-14 object-cover rounded-lg border border-slate-300 shrink-0"
                    onError={(e) => {
                      const fallback = storageService.getImageFallbackDataUrl(guardian1.photoUrl, guardian1.photoAssetId);
                      if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                    }}
                  />
                  <div className="text-xs min-w-0 flex-1">
                    <div className="font-bold text-slate-800 truncate">
                      {guardian1.prefix}
                      {guardian1.firstName} {guardian1.lastName}
                    </div>
                    <div className="text-slate-500 truncate font-sarabun">
                      นักเรียน: {student1.prefix}
                      {student1.firstName} ({student1.nickname})
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10px]">
                        รหัส {student1.studentId}
                      </span>
                      <span className="text-slate-400 font-sarabun text-[11px]">
                        {formatStudentGradeRoom(student1, currentAcademicYear)}
                      </span>
                      {card1.printCount > 0 && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                          เคยพิมพ์แล้ว {card1.printCount} ครั้ง
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-700 font-semibold font-sarabun truncate">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        รูปแบบหน้าบัตร: {design1.name || design1.title}
                        {!card1.frontDesignId && !overrideDesign1Id && ' (ตามระดับชั้น)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePickerSlot(1);
                      setSearchQuery('');
                    }}
                    className="flex-1 min-w-[130px] py-1.5 px-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    เปลี่ยนบัตรใบที่ 1
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateSlot1}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="คัดลอกบัตรนี้ไปยังใบที่ 2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอกลงใบที่ 2
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCard1Id('');
                      setOverrideDesign1Id(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ล้างช่อง 1
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 mb-2">ยังไม่ได้เลือกบัตรในช่องที่ 1</p>
                <button
                  type="button"
                  onClick={() => {
                    setActivePickerSlot(1);
                    setSearchQuery('');
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  เลือกบัตรรับส่งนักเรียน
                </button>
              </div>
            )}
            {/* Slot 1 Edit Guardian Card Button */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={!card1}
                onClick={() => {
                  if (card1 && onEditCard) {
                    onEditCard(card1.id);
                  }
                }}
                className={`w-full py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  card1
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer'
                    : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                แก้ไขบัตรผู้ปกครอง
              </button>
            </div>
          </div>

          {/* Slot 2 Box */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              enableSlot2
                ? 'bg-white border-blue-200 shadow-xs'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-bold text-slate-800">
                  บัตรใบที่ 2 (ถาดตำแหน่งล่าง)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSlot2}
                    onChange={(e) => setEnableSlot2(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>เปิดพิมพ์ช่องนี้</span>
                </label>
              </div>
            </div>

            {card2 && student2 && guardian2 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <img
                    src={storageService.resolveImageSrc(guardian2.photoUrl, guardian2.photoAssetId)}
                    alt={guardian2.firstName}
                    className="w-12 h-14 object-cover rounded-lg border border-slate-300 shrink-0"
                    onError={(e) => {
                      const fallback = storageService.getImageFallbackDataUrl(guardian2.photoUrl, guardian2.photoAssetId);
                      if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                    }}
                  />
                  <div className="text-xs min-w-0 flex-1">
                    <div className="font-bold text-slate-800 truncate">
                      {guardian2.prefix}
                      {guardian2.firstName} {guardian2.lastName}
                    </div>
                    <div className="text-slate-500 truncate font-sarabun">
                      นักเรียน: {student2.prefix}
                      {student2.firstName} ({student2.nickname})
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10px]">
                        รหัส {student2.studentId}
                      </span>
                      <span className="text-slate-400 font-sarabun text-[11px]">
                        {formatStudentGradeRoom(student2, currentAcademicYear)}
                      </span>
                      {card2.printCount > 0 && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                          เคยพิมพ์แล้ว {card2.printCount} ครั้ง
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-700 font-semibold font-sarabun truncate">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        รูปแบบหน้าบัตร: {design2.name || design2.title}
                        {!card2.frontDesignId && ' (ตามระดับชั้น)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePickerSlot(2);
                      setSearchQuery('');
                    }}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    เปลี่ยนบัตรใบที่ 2
                  </button>

                  <button
                    type="button"
                    onClick={() => setCard2Id('')}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ล้างช่อง 2
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 mb-2">ยังไม่ได้เลือกบัตรในช่องที่ 2</p>
                <button
                  type="button"
                  onClick={() => {
                    setActivePickerSlot(2);
                    setSearchQuery('');
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  เลือกบัตรรับส่งนักเรียน
                </button>
              </div>
            )}
            {/* Slot 2 Edit Guardian Card Button */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={!card2}
                onClick={() => {
                  if (card2 && onEditCard) {
                    onEditCard(card2.id);
                  }
                }}
                className={`w-full py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  card2
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer'
                    : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                แก้ไขบัตรผู้ปกครอง
              </button>
            </div>
          </div>

          {/* Tray Profile Info Notice */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ขนาดถาดปัจจุบัน: {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} มม. ({trayConfig.printerProfile || 'กำหนดเอง'})
            </div>
            <p className="text-[11px] text-slate-500">
              ในการตั้งค่าหน้าต่างสั่งพิมพ์ของเบราว์เซอร์: ให้เลือกกระดาษเป็น <strong>CD/DVD</strong> หรือ <strong>User-Defined ({trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} mm)</strong>, ตั้งขอบกระดาษ (Margins) เป็น <strong>None</strong> และเปิดตัวเลือก <strong>Background Graphics</strong>
            </p>
          </div>
        </div>

        {/* Right Column: Physical Epson / Canon PVC Tray Visualizer */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>จำลองการวางบนถาดจริง ({trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} มม.)</span>
              {trayConfig.rotate180 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                  <RotateCw className="w-3 h-3" />
                  หมุนถาด 180°
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              ช่อง 1: ({trayConfig.card1X}, {trayConfig.card1Y}) | ช่อง 2: ({trayConfig.card2X}, {trayConfig.card2Y}) มม.
            </span>
          </div>

          {/* Physical Tray Simulation */}
          <div className="py-4 px-6 bg-slate-100 rounded-2xl border border-slate-200 flex justify-center w-full overflow-auto max-h-[640px]">
            {/* Tray Body (Proportional: scale 2.4) */}
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
                {/* Slot 1 Guide Cutout */}
                <div
                  className={`absolute transition-all rounded-[5px] ${
                    enableSlot1 ? 'shadow-md ring-2 ring-blue-400/50' : 'opacity-30'
                  }`}
                  style={{
                    left: `${trayConfig.card1X * 2.4}px`,
                    top: `${trayConfig.card1Y * 2.4}px`,
                    width: `${trayConfig.cardWidthMm * 2.4}px`,
                    height: `${trayConfig.cardHeightMm * 2.4}px`,
                  }}
                >
                  {enableSlot1 && card1 ? (
                    <CardPreview
                      design={design1}
                      student={student1}
                      guardian={guardian1}
                      card={card1}
                      scale={(trayConfig.cardWidthMm * 2.4) / 323.5}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700/80 border-2 border-dashed border-slate-500 rounded-[5px] flex items-center justify-center text-slate-400 text-xs font-medium">
                      {enableSlot1 ? 'ช่องที่ 1 (ว่าง)' : 'ปิดการพิมพ์'}
                    </div>
                  )}

                  {/* Alignment Crosshair Pattern */}
                  {showTestPattern && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500"></div>
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500"></div>
                      <span className="absolute top-1 left-1 text-[8px] text-red-400 font-mono">1</span>
                    </div>
                  )}
                </div>

                {/* Slot 2 Guide Cutout */}
                <div
                  className={`absolute transition-all rounded-[5px] ${
                    enableSlot2 ? 'shadow-md ring-2 ring-blue-400/50' : 'opacity-30'
                  }`}
                  style={{
                    left: `${trayConfig.card2X * 2.4}px`,
                    top: `${trayConfig.card2Y * 2.4}px`,
                    width: `${trayConfig.cardWidthMm * 2.4}px`,
                    height: `${trayConfig.cardHeightMm * 2.4}px`,
                  }}
                >
                  {enableSlot2 && card2 ? (
                    <CardPreview
                      design={design2}
                      student={student2}
                      guardian={guardian2}
                      card={card2}
                      scale={(trayConfig.cardWidthMm * 2.4) / 323.5}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700/80 border-2 border-dashed border-slate-500 rounded-[5px] flex items-center justify-center text-slate-400 text-xs font-medium">
                      {enableSlot2 ? 'ช่องที่ 2 (ว่าง)' : 'ปิดการพิมพ์'}
                    </div>
                  )}

                  {showTestPattern && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500"></div>
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500"></div>
                      <span className="absolute top-1 left-1 text-[8px] text-red-400 font-mono">2</span>
                    </div>
                  )}
                </div>

                {/* Bottom Tray Arrow Feed Direction Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-slate-400">
                  <span className="text-[9px] font-mono tracking-widest uppercase whitespace-nowrap">
                    FEED ARROW ▼
                  </span>
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-400"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Picker Modal */}
      {activePickerSlot !== null && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" />
                  เลือกบัตรรับส่งนักเรียนลงในช่องที่ {activePickerSlot}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ค้นหาจากรหัสนักเรียน 5 หลัก, ชื่อ-นามสกุล หรือชื่อผู้ปกครอง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePickerSlot(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาด้วยรหัส 5 หลัก, ชื่อนักเรียน หรือชื่อผู้ปกครอง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  autoFocus
                />
              </div>
            </div>

            {/* Cards List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {filteredCards.length > 0 ? (
                filteredCards.map((c) => {
                  const s = students.find((st) => st.studentId === c.studentId);
                  const g = guardians.find((gd) => gd.id === c.guardianId);
                  if (!s || !g) return null;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (activePickerSlot === 1) {
                          setCard1Id(c.id);
                          setOverrideDesign1Id(null);
                          setEnableSlot1(true);
                        } else {
                          setCard2Id(c.id);
                          setEnableSlot2(true);
                        }
                        setActivePickerSlot(null);
                        onNotify(`เลือกบัตรของนักเรียน ${s.firstName} ลงช่องที่ ${activePickerSlot} แล้ว`, 'info');
                      }}
                      className="p-3 bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={storageService.resolveImageSrc(g.photoUrl, g.photoAssetId)}
                          alt={g.firstName}
                          className="w-11 h-13 object-cover rounded-md border border-slate-200 shrink-0"
                          onError={(e) => {
                            const fallback = storageService.getImageFallbackDataUrl(g.photoUrl, g.photoAssetId);
                            if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                          }}
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800">
                            {g.prefix}
                            {g.firstName} {g.lastName}
                            <span className="text-slate-400 font-normal ml-1">({g.relation})</span>
                          </div>
                          <div className="text-slate-600 font-sarabun mt-0.5">
                            นักเรียน: {s.prefix}
                            {s.firstName} {s.lastName} ({s.nickname})
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold rounded text-[10px]">
                              รหัส {s.studentId}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-sarabun text-[10px]">
                              {formatStudentGradeRoom(s, currentAcademicYear)} ({s.level})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-lg border border-blue-200"
                        >
                          เลือก
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ไม่พบบัตรที่ตรงกับเงื่อนไขการค้นหา
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setActivePickerSlot(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              >
                ยกเลิก
              </button>
            </div>
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
              เบราว์เซอร์ป้องกันการเปิดแท็บใหม่อัตโนมัติ กรุณากดปุ่มด้านล่างเพื่อเปิดหน้าตัวอย่างการพิมพ์ลงถาด PVC ในแท็บใหม่
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
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5"
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
