import React, { useState, useEffect, useMemo } from 'react';
import {
  CardDesignConfig,
  Guardian,
  PickupCard,
  PrintHeaderPreset,
  Student,
} from '../types';
import { storageService } from '../utils/storage';
import {
  calculateCurrentGrade,
  formatThaiDateFull,
  formatThaiDateShort,
  getTodayDateString,
} from '../utils/thaiDate';
import {
  GUARDIAN_RELATION_ORDER,
  sortCardsByGuardianRelation,
} from '../utils/relations';
import { CardPreview } from './CardPreview';
import { ThaiDatePicker } from './ThaiDatePicker';
import { RegistryPrintSheet } from './RegistryPrintSheet';
import {
  Search,
  User,
  GraduationCap,
  Calendar,
  CreditCard,
  Printer,
  FileText,
  Save,
  Plus,
  Trash2,
  Star,
  ZoomIn,
  ZoomOut,
  X,
  Eye,
  Bookmark,
  Loader2,
  Phone,
  Users,
  ArrowUpRight,
} from 'lucide-react';

interface GuardianCardRegistryViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSendCardToPrintTray?: (cardId: string) => void;
}

const DEFAULT_CUSTOM_HEADER_TITLE = 'ทะเบียนบัตรรับส่งผู้ปกครองนักเรียน';
const DEFAULT_CUSTOM_HEADER_SUBTITLE = 'เอกสารตรวจสอบข้อมูลนักเรียนและผู้ปกครองผู้มีสิทธิ์รับส่ง';

export const GuardianCardRegistryView: React.FC<GuardianCardRegistryViewProps> = ({
  onNotify,
  onSendCardToPrintTray,
}) => {
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [frontDesigns, setFrontDesigns] = useState<CardDesignConfig[]>(() =>
    storageService.getFrontDesigns()
  );
  const [printHeaders, setPrintHeaders] = useState<PrintHeaderPreset[]>(() =>
    storageService.getPrintHeaders()
  );
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear()
  );

  useEffect(() => {
    return storageService.subscribe(() => {
      setStudents(storageService.getStudents());
      setGuardians(storageService.getGuardians());
      setCards(storageService.getCards());
      setFrontDesigns(storageService.getFrontDesigns());
      setPrintHeaders(storageService.getPrintHeaders());
      setCurrentAcademicYear(storageService.getAcademicYear());
    });
  }, []);

  // Unified Student Search State (รหัสนักเรียน, ชื่อ, สกุล, ชั้น)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    const initialStudents = storageService.getStudents();
    const initialCards = storageService.getCards();
    const withCards = initialStudents.find((s) =>
      initialCards.some((c) => c.studentId === s.studentId)
    );
    return withCards?.studentId || initialStudents[0]?.studentId || '';
  });

  // Document date (วันที่)
  const [reportDate, setReportDate] = useState<string>(() => getTodayDateString());

  // Card zoom inspect modal
  const [inspectedCardId, setInspectedCardId] = useState<string | null>(null);

  // A4 Print Preview Modal & Configuration State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [columnsPerRow, setColumnsPerRow] = useState<1 | 2>(1);
  const [repeatHeader, setRepeatHeader] = useState<boolean>(true);
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(true);
  const [previewZoom, setPreviewZoom] = useState<number>(0.68);
  const [selectedDesignId, setSelectedDesignId] = useState<string>('');

  // Custom Header Form & Saved DB Preset State
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>(() => {
    const existing = storageService.getPrintHeaders();
    const def = existing.find((h) => h.isDefault) || existing[0];
    return def?.id || '';
  });
  const [headerTitle, setHeaderTitle] = useState<string>(() => {
    const existing = storageService.getPrintHeaders();
    const def = existing.find((h) => h.isDefault) || existing[0];
    return def?.title || DEFAULT_CUSTOM_HEADER_TITLE;
  });
  const [headerSubtitle, setHeaderSubtitle] = useState<string>(() => {
    const existing = storageService.getPrintHeaders();
    const def = existing.find((h) => h.isDefault) || existing[0];
    return def ? def.subtitle || '' : DEFAULT_CUSTOM_HEADER_SUBTITLE;
  });
  const [isSavingHeader, setIsSavingHeader] = useState<boolean>(false);

  // Lookup Maps
  const guardianMap = useMemo(() => {
    return new Map(guardians.map((g) => [g.id, g]));
  }, [guardians]);

  const cardCountByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      map.set(c.studentId, (map.get(c.studentId) || 0) + 1);
    }
    return map;
  }, [cards]);

  // Unified Search Filtering across รหัสนักเรียน, ชื่อ, สกุล, ชื่อเล่น, ชั้น, ห้อง
  const filteredStudents = useMemo(() => {
    const sorted = [...students].sort((a, b) => a.studentId.localeCompare(b.studentId));
    const rawQ = searchQuery.trim().toLowerCase();
    if (!rawQ) return sorted;

    const tokens = rawQ.split(/\s+/).filter(Boolean);
    return sorted.filter((s) => {
      const grade = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
      const gradeAndRoom = `${grade.gradeLabel}/${s.classroom}`.toLowerCase();
      const gradeWithWord = `${grade.gradeLabel} ห้อง ${s.classroom}`.toLowerCase();
      const searchable = [
        s.studentId,
        s.prefix,
        s.firstName,
        s.lastName,
        `${s.prefix}${s.firstName} ${s.lastName}`,
        `${s.firstName} ${s.lastName}`,
        s.nickname || '',
        s.level,
        s.classroom,
        grade.gradeLabel,
        gradeAndRoom,
        gradeWithWord,
        String(s.entryYear),
      ]
        .join(' ')
        .toLowerCase();

      return tokens.every((tok) => searchable.includes(tok));
    });
  }, [students, searchQuery, currentAcademicYear]);

  // Auto-select valid student if current selection disappears or exact student ID matches
  useEffect(() => {
    if (students.length === 0) {
      if (selectedStudentId !== '') setSelectedStudentId('');
      return;
    }

    const trimmed = searchQuery.trim();
    if (/^\d{5}$/.test(trimmed)) {
      const exact = students.find((s) => s.studentId === trimmed);
      if (exact && exact.studentId !== selectedStudentId) {
        setSelectedStudentId(exact.studentId);
        return;
      }
    }

    const stillExists = students.some((s) => s.studentId === selectedStudentId);
    if (!stillExists) {
      const firstMatch = filteredStudents[0] || students[0];
      if (firstMatch) setSelectedStudentId(firstMatch.studentId);
    }
  }, [students, filteredStudents, selectedStudentId, searchQuery]);

  // Sync default saved header when printHeaders loads initially if user hasn't customized
  useEffect(() => {
    if (printHeaders.length > 0 && !selectedHeaderId) {
      const def = printHeaders.find((h) => h.isDefault) || printHeaders[0];
      if (def) {
        setSelectedHeaderId(def.id);
        setHeaderTitle(def.title);
        setHeaderSubtitle(def.subtitle || '');
      }
    }
  }, [printHeaders, selectedHeaderId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // Cards for selected student sorted strictly by guardian relation order
  const sortedStudentCards = useMemo(() => {
    if (!selectedStudent) return [];
    const linked = cards.filter((c) => c.studentId === selectedStudent.studentId);
    return sortCardsByGuardianRelation(linked, guardianMap);
  }, [cards, selectedStudent, guardianMap]);

  // Resolve Front Card Design for selected student
  const activeFrontDesign = useMemo(() => {
    if (selectedDesignId) {
      const picked = frontDesigns.find((d) => d.id === selectedDesignId);
      if (picked) return picked;
    }
    const level = selectedStudent?.level || 'มัธยมศึกษาตอนต้น';
    return (
      frontDesigns.find((d) => d.level === level && d.isDefault) ||
      frontDesigns.find((d) => d.level === level) ||
      storageService.getCardDesign(level)
    );
  }, [frontDesigns, selectedDesignId, selectedStudent]);

  // Keep selectedDesignId matched to student level default when switching students
  useEffect(() => {
    if (!selectedStudent) return;
    const defForLevel =
      frontDesigns.find((d) => d.level === selectedStudent.level && d.isDefault) ||
      frontDesigns.find((d) => d.level === selectedStudent.level);
    if (defForLevel) {
      setSelectedDesignId(defForLevel.id);
    }
  }, [selectedStudent?.studentId, selectedStudent?.level, frontDesigns]);

  // Student Grade
  const studentAcademicInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const gradeInfo = calculateCurrentGrade(
      selectedStudent.level,
      selectedStudent.entryYear,
      currentAcademicYear
    );
    return { gradeInfo };
  }, [selectedStudent, currentAcademicYear]);

  // Inspected Card Details
  const inspectedCard = useMemo(() => {
    if (!inspectedCardId) return null;
    return sortedStudentCards.find((c) => c.id === inspectedCardId) || null;
  }, [inspectedCardId, sortedStudentCards]);

  // Saved Custom Header Handlers
  const handleSelectHeaderPreset = (presetId: string) => {
    setSelectedHeaderId(presetId);
    if (!presetId) return;
    const found = printHeaders.find((h) => h.id === presetId);
    if (found) {
      setHeaderTitle(found.title);
      setHeaderSubtitle(found.subtitle || '');
    }
  };

  const handleSaveNewHeaderPreset = async () => {
    const cleanTitle = headerTitle.trim();
    if (!cleanTitle) {
      onNotify('กรุณากรอกข้อความหัวกระดาษก่อนบันทึก', 'error');
      return;
    }
    setIsSavingHeader(true);
    try {
      const saved = await storageService.savePrintHeader({
        title: cleanTitle,
        subtitle: headerSubtitle.trim(),
        isDefault: printHeaders.length === 0,
      });
      setSelectedHeaderId(saved.id);
      onNotify('บันทึกหัวกระดาษใหม่ลงฐานข้อมูลเรียบร้อยแล้ว', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกหัวกระดาษลงฐานข้อมูลได้',
        'error'
      );
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleUpdateSelectedHeaderPreset = async () => {
    if (!selectedHeaderId) {
      await handleSaveNewHeaderPreset();
      return;
    }
    const cleanTitle = headerTitle.trim();
    if (!cleanTitle) {
      onNotify('กรุณากรอกข้อความหัวกระดาษก่อนอัปเดต', 'error');
      return;
    }
    setIsSavingHeader(true);
    try {
      const updated = await storageService.savePrintHeader({
        id: selectedHeaderId,
        title: cleanTitle,
        subtitle: headerSubtitle.trim(),
      });
      setSelectedHeaderId(updated.id);
      onNotify('อัปเดตหัวกระดาษที่เลือกในฐานข้อมูลแล้ว', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปเดตหัวกระดาษได้',
        'error'
      );
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleSetDefaultHeaderPreset = async (headerId: string) => {
    setIsSavingHeader(true);
    try {
      await storageService.setDefaultPrintHeader(headerId);
      onNotify('ตั้งหัวกระดาษนี้เป็นค่าเริ่มต้นเรียบร้อยแล้ว', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถตั้งค่าเริ่มต้นได้',
        'error'
      );
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleDeleteHeaderPreset = async (headerId: string) => {
    setIsSavingHeader(true);
    try {
      await storageService.deletePrintHeader(headerId);
      if (selectedHeaderId === headerId) {
        const remaining = storageService.getPrintHeaders();
        const next = remaining.find((h) => h.isDefault) || remaining[0];
        if (next) {
          setSelectedHeaderId(next.id);
          setHeaderTitle(next.title);
          setHeaderSubtitle(next.subtitle || '');
        } else {
          setSelectedHeaderId('');
        }
      }
      onNotify('ลบหัวกระดาษออกจากฐานข้อมูลแล้ว', 'info');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถลบหัวกระดาษได้',
        'error'
      );
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleOpenPrintPreview = () => {
    if (!selectedStudent) {
      onNotify('กรุณาค้นหาและเลือกนักเรียนก่อนเปิดตัวอย่างการพิมพ์ A4', 'error');
      return;
    }
    setPreviewZoom(paperOrientation === 'portrait' ? 0.68 : 0.56);
    setIsPrintPreviewOpen(true);
  };

  const handlePrintNow = () => {
    if (!selectedStudent) return;
    window.print();
  };

  const pageWidthMm = paperOrientation === 'portrait' ? 210 : 297;
  const pageHeightMm = paperOrientation === 'portrait' ? 297 : 210;

  return (
    <>
      {/* Dynamic Print Page Size for A4 Portrait / Landscape */}
      <style>{`
        @media print {
          @page {
            size: ${pageWidthMm}mm ${pageHeightMm}mm;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Main Screen UI */}
      <div className="no-print space-y-5">
        {/* Page Header + Print Preview Action */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                ทะเบียนบัตรผู้ปกครอง
              </h1>
              <p className="text-xs text-slate-500 font-sarabun mt-0.5">
                ค้นหาข้อมูลนักเรียน ดูข้อมูลการศึกษา บัตรรับส่งผู้ปกครองเรียงตามความสัมพันธ์ และจัดพิมพ์รายงานขนาด A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {frontDesigns.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  แม่แบบบัตร:
                </label>
                <select
                  value={activeFrontDesign.id}
                  onChange={(e) => setSelectedDesignId(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-sarabun focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {frontDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.title} ({d.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenPrintPreview}
              disabled={!selectedStudent}
              className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>ตัวอย่างก่อนพิมพ์ A4 / ตั้งค่าหัวกระดาษ</span>
            </button>
          </div>
        </div>

        {/* 1. Unified Student Search Input Box */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="registry-student-search"
              className="text-sm font-bold text-slate-800 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-blue-600" />
              <span>ค้นหาข้อมูลนักเรียน (รหัสนักเรียน, ชื่อ, นามสกุล, ชั้น)</span>
            </label>
            <span className="text-xs text-slate-500 font-sarabun">
              พบนักเรียนที่ตรงกัน{' '}
              <strong className="text-blue-700 font-mono">{filteredStudents.length}</strong> จากทั้งหมด{' '}
              <strong className="font-mono">{students.length}</strong> คน
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="registry-student-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์รหัสนักเรียน 5 หลัก, ชื่อ, นามสกุล หรือชั้น เช่น 50101, สมชาย, ม.1/2 ..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-sarabun transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Matching Student Selector Pills */}
          {students.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-sarabun">
              ยังไม่มีข้อมูลนักเรียนในระบบ กรุณาเพิ่มข้อมูลนักเรียนในเมนู &quot;ข้อมูลนักเรียน&quot; ก่อน
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-sarabun text-center">
              ไม่พบข้อมูลนักเรียนที่ตรงกับคำค้นหา &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
              {filteredStudents.slice(0, 30).map((student) => {
                const isSelected = student.studentId === selectedStudentId;
                const grade = calculateCurrentGrade(
                  student.level,
                  student.entryYear,
                  currentAcademicYear
                );
                const count = cardCountByStudent.get(student.studentId) || 0;
                return (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => setSelectedStudentId(student.studentId)}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span
                      className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {student.studentId}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold whitespace-nowrap">
                        {student.prefix}
                        {student.firstName} {student.lastName}
                      </div>
                      <div
                        className={`text-[11px] font-sarabun flex items-center gap-1.5 ${
                          isSelected ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        <span>
                          {grade.gradeLabel}/{student.classroom}
                        </span>
                        <span>•</span>
                        <span>บัตร {count} ใบ</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredStudents.length > 30 && (
                <span className="shrink-0 text-[11px] text-slate-400 font-sarabun px-2">
                  +{filteredStudents.length - 30} คน (พิมพ์ค้นหาเพิ่มเติมเพื่อเจาะจง)
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. First Info Box: Student Information */}
        {selectedStudent && studentAcademicInfo && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    ชุดข้อมูลที่ 1 : ข้อมูลนักเรียน
                  </h2>
                  <p className="text-[11px] text-slate-500 font-sarabun">
                    แสดงรายละเอียดนักเรียน วันที่ เข้าศึกษา และกำลังศึกษา
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-200/80">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">วันที่:</span>
                <div className="w-48">
                  <ThaiDatePicker
                    value={reportDate}
                    onChange={(val) => setReportDate(val)}
                    label="เลือกวันที่เอกสาร"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Student Identity */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-sarabun">
                  รหัสนักเรียน / ชื่อ-นามสกุล
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-mono text-xs font-bold">
                    {selectedStudent.studentId}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedStudent.prefix}
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-sarabun">
                  {selectedStudent.nickname ? `ชื่อเล่น: ${selectedStudent.nickname} • ` : ''}
                  {selectedStudent.level}
                </div>
              </div>

              {/* วันที่ */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-sarabun flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>วันที่</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {formatThaiDateFull(reportDate)}
                </div>
                <div className="text-xs text-slate-500 font-sarabun">
                  ปีการศึกษาปัจจุบัน พ.ศ. {currentAcademicYear}
                </div>
              </div>

              {/* เข้าศึกษา & กำลังศึกษา */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-sarabun flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เข้าศึกษา / กำลังศึกษา</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  เข้าศึกษา: ปี พ.ศ. {selectedStudent.entryYear}
                </div>
                <div className="text-xs font-semibold text-indigo-700 font-sarabun">
                  กำลังศึกษา: {studentAcademicInfo.gradeInfo.gradeLabel} ห้อง{' '}
                  {selectedStudent.classroom}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3 & 5. Second Info Box: Guardian Pickup Cards Sorted Strictly by Relation */}
        {selectedStudent && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    ชุดข้อมูลที่ 2 : ข้อมูลบัตรรับส่งผู้ปกครองนักเรียน
                  </h2>
                  <p className="text-[11px] text-slate-500 font-sarabun">
                    เรียงลำดับตามความสัมพันธ์: {GUARDIAN_RELATION_ORDER.join(' → ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                  ทั้งหมด {sortedStudentCards.length} บัตร
                </span>
              </div>
            </div>

            <div className="p-5">
              {sortedStudentCards.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-600">
                    ยังไม่มีบัตรรับส่งผู้ปกครองสำหรับนักเรียนคนนี้
                  </div>
                  <p className="text-xs text-slate-400 font-sarabun">
                    สามารถเพิ่มผู้ปกครองและออกบัตรรับส่งได้ที่เมนู &quot;บัตรรับส่งและผู้ปกครอง&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {sortedStudentCards.map((card, index) => {
                    const guardian = guardianMap.get(card.guardianId);
                    const guardianFullName = guardian
                      ? `${guardian.prefix}${guardian.firstName} ${guardian.lastName}`.trim()
                      : 'ไม่พบข้อมูลผู้ปกครอง';
                    const relation = guardian?.relation || '-';

                    return (
                      <div
                        key={card.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-blue-300 transition-all p-4 flex flex-col sm:flex-row items-center sm:items-stretch gap-4 shadow-2xs"
                      >
                        {/* Left: Guardian Pickup Card Visual */}
                        <div className="shrink-0 flex flex-col items-center gap-1.5">
                          <div
                            onClick={() => setInspectedCardId(card.id)}
                            className="relative group cursor-pointer rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white"
                            title="คลิกเพื่อขยายดูบัตร"
                          >
                            <CardPreview
                              design={activeFrontDesign}
                              student={selectedStudent}
                              guardian={guardian}
                              card={card}
                              scale={0.72}
                            />
                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="px-2.5 py-1 rounded-lg bg-white/95 text-slate-800 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                ขยายบัตร
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Guardian Details */}
                        <div className="flex-1 min-w-0 w-full flex flex-col justify-between gap-2.5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-mono text-[11px] font-bold">
                                  #{index + 1}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">
                                  {relation}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                  card.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : card.status === 'expired'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {card.status === 'active'
                                  ? 'ใช้งานได้'
                                  : card.status === 'expired'
                                  ? 'หมดอายุ'
                                  : 'ยกเลิก'}
                              </span>
                            </div>

                            <div className="text-sm font-bold text-slate-900 leading-snug">
                              {guardianFullName}
                            </div>

                            <div className="grid grid-cols-1 gap-1.5 text-xs font-sarabun bg-white rounded-xl border border-slate-200/80 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">ความสัมพันธ์:</span>
                                <span className="font-bold text-slate-800">{relation}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">วันที่ออกบัตร:</span>
                                <span className="font-semibold text-slate-800">
                                  {formatThaiDateShort(card.issueDate)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">วันที่หมดอายุ:</span>
                                <span className="font-semibold text-slate-800">
                                  {formatThaiDateShort(card.expiryDate)}
                                </span>
                              </div>
                              {guardian?.phone && (
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    โทรศัพท์:
                                  </span>
                                  <span className="font-mono text-slate-700">{guardian.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setInspectedCardId(card.id)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              ดูบัตรใหญ่
                            </button>
                            {onSendCardToPrintTray && (
                              <button
                                type="button"
                                onClick={() => onSendCardToPrintTray(card.id)}
                                className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                ส่งลงถาดพิมพ์ PVC
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
          </div>
        )}
      </div>

      {/* Inspect Enlarged Card Modal */}
      {inspectedCard && selectedStudent && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectedCardId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">ตัวอย่างบัตรรับส่งผู้ปกครอง</h3>
                <p className="text-xs text-slate-500 font-sarabun">
                  นักเรียน: {selectedStudent.studentId} {selectedStudent.prefix}
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCardId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center py-2">
              <CardPreview
                design={activeFrontDesign}
                student={selectedStudent}
                guardian={guardianMap.get(inspectedCard.guardianId)}
                card={inspectedCard}
                scale={1.15}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. A4 Print Preview & Saved Custom Header Modal */}
      {isPrintPreviewOpen && selectedStudent && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex flex-col">
          {/* Top Bar */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  ตัวอย่างก่อนพิมพ์กระดาษ A4 — ทะเบียนบัตรผู้ปกครอง
                </h2>
                <p className="text-[11px] text-slate-500 font-sarabun">
                  {selectedStudent.studentId} {selectedStudent.prefix}
                  {selectedStudent.firstName} {selectedStudent.lastName} •{' '}
                  {paperOrientation === 'portrait'
                    ? 'แนวตั้ง (210 × 297 มม.)'
                    : 'แนวนอน (297 × 210 มม.)'}{' '}
                  • {columnsPerRow} คอลัมน์
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))
                  }
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                  title="ย่อ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-700 min-w-[48px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(2))))
                  }
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                  title="ขยาย"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrintNow}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>สั่งพิมพ์ A4 (Print)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>ปิดหน้าต่าง</span>
              </button>
            </div>
          </div>

          {/* Body: Left Config Panel + Right A4 Live Preview Stage */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Settings Sidebar */}
            <aside className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-4 sm:p-5 space-y-5 shrink-0">
              {/* Orientation & Columns */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  1. รูปแบบหน้ากระดาษ A4
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaperOrientation('portrait');
                      setPreviewZoom(0.68);
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      paperOrientation === 'portrait'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    แนวตั้ง (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaperOrientation('landscape');
                      setPreviewZoom(0.56);
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      paperOrientation === 'landscape'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    แนวนอน (Landscape)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setColumnsPerRow(1)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                      columnsPerRow === 1
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    1 คอลัมน์ / แถว
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnsPerRow(2)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                      columnsPerRow === 2
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    2 คอลัมน์ / แถว
                  </button>
                </div>
              </div>

              {/* Repeat Header & Page Numbers */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-800">
                  2. ตัวเลือกการพิมพ์ซ้ำและเลขหน้า
                </div>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <span className="text-xs font-medium text-slate-700 font-sarabun">
                    พิมพ์ซ้ำหัวกระดาษทุกหน้า (Repeat Header)
                  </span>
                  <input
                    type="checkbox"
                    checked={repeatHeader}
                    onChange={(e) => setRepeatHeader(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <span className="text-xs font-medium text-slate-700 font-sarabun">
                    แสดงเลขหน้า (Page Numbers)
                  </span>
                  <input
                    type="checkbox"
                    checked={showPageNumbers}
                    onChange={(e) => setShowPageNumbers(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Custom Header + Database Presets */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                    <span>3. หัวกระดาษพิมพ์เอง & ฐานข้อมูล</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {printHeaders.length} รายการ
                  </span>
                </div>

                {/* Saved Presets Recall List */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600 font-sarabun">
                    เรียกใช้หัวกระดาษที่บันทึกไว้ในฐานข้อมูล:
                  </label>
                  {printHeaders.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[11px] text-slate-500 font-sarabun">
                      ยังไม่มีหัวกระดาษที่บันทึกไว้ในฐานข้อมูล พิมพ์หัวกระดาษด้านล่างแล้วกด &quot;บันทึกเพิ่มลงฐานข้อมูล&quot;
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                      {printHeaders.map((preset) => {
                        const isPicked = selectedHeaderId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            className={`p-2 rounded-xl border transition-colors flex items-start justify-between gap-2 ${
                              isPicked
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectHeaderPreset(preset.id)}
                              className="flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                                {preset.isDefault && (
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                                <span className="truncate">{preset.title}</span>
                              </div>
                              {preset.subtitle && (
                                <div className="text-[11px] text-slate-500 truncate font-sarabun">
                                  {preset.subtitle}
                                </div>
                              )}
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              {!preset.isDefault && (
                                <button
                                  type="button"
                                  disabled={isSavingHeader}
                                  onClick={() => handleSetDefaultHeaderPreset(preset.id)}
                                  className="p-1 text-slate-400 hover:text-amber-500 rounded-lg cursor-pointer"
                                  title="ตั้งเป็นค่าเริ่มต้น"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isSavingHeader}
                                onClick={() => handleDeleteHeaderPreset(preset.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="ลบออกจากฐานข้อมูล"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Header Inputs */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-sarabun">
                      ข้อความหัวกระดาษ (บรรทัดหลัก)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={headerTitle}
                      onChange={(e) => setHeaderTitle(e.target.value)}
                      placeholder="เช่น ทะเบียนบัตรรับส่งผู้ปกครองนักเรียน"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-sarabun">
                      ข้อความหัวกระดาษรอง (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={headerSubtitle}
                      onChange={(e) => setHeaderSubtitle(e.target.value)}
                      placeholder="เช่น โรงเรียน... ฝ่ายกิจการนักเรียน"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSavingHeader || !headerTitle.trim()}
                      onClick={handleSaveNewHeaderPreset}
                      className="w-full px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingHeader ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>บันทึกเพิ่มลงฐานข้อมูล</span>
                    </button>

                    {selectedHeaderId && (
                      <button
                        type="button"
                        disabled={isSavingHeader || !headerTitle.trim()}
                        onClick={handleUpdateSelectedHeaderPreset}
                        className="w-full px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>บันทึกทับรายการที่เลือกอยู่</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Preview Canvas */}
            <div className="flex-1 bg-slate-200/90 overflow-auto p-6 sm:p-8 flex justify-center items-start">
              <RegistryPrintSheet
                student={selectedStudent}
                cards={sortedStudentCards}
                guardianMap={guardianMap}
                frontDesign={activeFrontDesign}
                currentAcademicYear={currentAcademicYear}
                paperOrientation={paperOrientation}
                columnsPerRow={columnsPerRow}
                repeatHeader={repeatHeader}
                showPageNumbers={showPageNumbers}
                headerTitle={headerTitle}
                headerSubtitle={headerSubtitle}
                reportDate={reportDate}
                zoom={previewZoom}
                isPrintMode={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print-Only Sheet (Rendered 1:1 on A4 when printing via window.print()) */}
      {selectedStudent && (
        <div className="hidden print:block">
          <RegistryPrintSheet
            student={selectedStudent}
            cards={sortedStudentCards}
            guardianMap={guardianMap}
            frontDesign={activeFrontDesign}
            currentAcademicYear={currentAcademicYear}
            paperOrientation={paperOrientation}
            columnsPerRow={columnsPerRow}
            repeatHeader={repeatHeader}
            showPageNumbers={showPageNumbers}
            headerTitle={headerTitle}
            headerSubtitle={headerSubtitle}
            reportDate={reportDate}
            zoom={1}
            isPrintMode={true}
          />
        </div>
      )}
    </>
  );
};
