import React, { useState, useEffect } from 'react';
import { Guardian, PickupCard, Student, CardDesignConfig } from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize, precompressAvatarPhoto } from '../utils/imageOptimizer';
import {
  formatThaiDateShort,
  getTodayDateString,
  calculateCardExpiryDate,
} from '../utils/thaiDate';
import { ThaiDatePicker } from './ThaiDatePicker';
import { CardPreview } from './CardPreview';
import { FirebaseImagePickerModal } from './FirebaseImagePickerModal';
import {
  ShieldCheck,
  UserCheck,
  CreditCard,
  Plus,
  Trash2,
  Printer,
  Search,
  Upload,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  FileImage,
  GraduationCap,
  Phone,
  Sparkles,
  X,
  Eye,
  Check,
  FolderOpen,
} from 'lucide-react';

interface GuardiansViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSendCardToPrintTray: (cardId: string) => void;
}

export const GuardiansView: React.FC<GuardiansViewProps> = ({
  onNotify,
  onSendCardToPrintTray,
}) => {
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [frontDesigns, setFrontDesigns] = useState<CardDesignConfig[]>(() =>
    storageService.getFrontDesigns()
  );
  const [isSavingGuardian, setIsSavingGuardian] = useState<boolean>(false);

  useEffect(() => {
    return storageService.subscribe(() => {
      setGuardians(storageService.getGuardians());
      setStudents(storageService.getStudents());
      setCards(storageService.getCards());
      setFrontDesigns(storageService.getFrontDesigns());
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'cards' | 'guardians'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isImagePickerOpen, setIsImagePickerOpen] = useState<boolean>(false);

  // Add/Edit Guardian Modal
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState<boolean>(false);
  const [guardianForm, setGuardianForm] = useState<{
    id?: string;
    prefix: string;
    firstName: string;
    lastName: string;
    relation: string;
    phone: string;
    photoUrl: string;
    photoFileName: string;
    photoStoragePath?: string;
    photoAssetId?: string;
    selectedFile: File | null;
  }>({
    prefix: 'นาย',
    firstName: '',
    lastName: '',
    relation: 'บิดา',
    phone: '',
    photoUrl: '',
    photoFileName: '',
    photoStoragePath: '',
    photoAssetId: '',
    selectedFile: null,
  });

  // Issue New Card Modal (Many-to-Many Linking)
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [guardianSearchQuery, setGuardianSearchQuery] = useState<string>('');
  const [cardForm, setCardForm] = useState<{
    studentId: string;
    guardianId: string;
    issueDate: string;
    expiryDate: string;
  }>({
    studentId: students[0]?.studentId || '',
    guardianId: guardians[0]?.id || '',
    issueDate: getTodayDateString(),
    expiryDate: calculateCardExpiryDate(students[0]?.entryYear || 2569),
  });
  const [previewDesignId, setPreviewDesignId] = useState<string>('auto');

  useEffect(() => {
    const url = guardianForm.photoUrl;
    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [guardianForm.photoUrl]);

  // Handle Photo File selection: instant ObjectURL preview + background pre-compression
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setGuardianForm((prev) => ({
      ...prev,
      photoUrl: previewUrl,
      photoFileName: file.name,
      photoStoragePath: '',
      photoAssetId: '',
      selectedFile: file,
    }));

    void precompressAvatarPhoto(file).catch(() => {
      // Errors will be surfaced during submit if compression fails
    });
  };

  // Save Guardian
  const handleSaveGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianForm.firstName.trim() || !guardianForm.lastName.trim()) {
      onNotify('กรุณาระบุชื่อและนามสกุลผู้ปกครอง', 'error');
      return;
    }

    setIsSavingGuardian(true);
    let finalPhotoUrl = guardianForm.photoUrl;
    let finalFileName = guardianForm.photoFileName || 'guardian_photo.jpg';
    let finalStoragePath = guardianForm.photoStoragePath || '';
    let finalPhotoAssetId = guardianForm.photoAssetId || '';
    let compressionNote = '';

    // If a new physical file was chosen, compress and save to Firebase (Firestore image_assets + Storage)
    if (guardianForm.selectedFile) {
      try {
        const uploadRes = await storageService.uploadGuardianPhoto(
          guardianForm.selectedFile,
          guardianForm.selectedFile.name
        );
        finalPhotoUrl = uploadRes.photoUrl;
        finalFileName = uploadRes.photoFileName;
        finalStoragePath = uploadRes.photoStoragePath;
        finalPhotoAssetId = uploadRes.photoAssetId;
        compressionNote = ` (บีบอัดรูป ${formatFileSize(uploadRes.originalSize)} → ${formatFileSize(uploadRes.compressedSize)} และบันทึกลง Firebase)`;
      } catch (err) {
        console.error('Upload failed', err);
        onNotify(
          err instanceof Error ? err.message : 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          'error'
        );
        setIsSavingGuardian(false);
        return;
      }
    }

    if (!finalPhotoUrl) {
      // Default avatar if none
      finalPhotoUrl =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" fill="%23cbd5e1"><rect width="100" height="120"/><circle cx="50" cy="40" r="25" fill="%23ffffff"/><circle cx="50" cy="95" r="40" fill="%23ffffff"/></svg>';
      finalFileName = 'default_avatar.svg';
      finalStoragePath = '';
      finalPhotoAssetId = '';
    }

    const newGuardian: Guardian = {
      id: guardianForm.id || 'guard_' + Date.now(),
      prefix: guardianForm.prefix,
      firstName: guardianForm.firstName.trim(),
      lastName: guardianForm.lastName.trim(),
      relation: guardianForm.relation,
      phone: guardianForm.phone.trim(),
      photoUrl: finalPhotoUrl,
      photoFileName: finalFileName,
      photoStoragePath: finalStoragePath,
      photoAssetId: finalPhotoAssetId,
      createdAt: new Date().toISOString(),
    };

    let updatedList: Guardian[];
    if (guardianForm.id) {
      updatedList = guardians.map((g) => (g.id === guardianForm.id ? newGuardian : g));
      onNotify(`อัปเดตข้อมูลผู้ปกครองเรียบร้อยแล้ว${compressionNote}`, 'success');
    } else {
      updatedList = [newGuardian, ...guardians];
      onNotify(`เพิ่มผู้ปกครอง "${newGuardian.firstName}" เข้าสู่ระบบสำเร็จ${compressionNote}`, 'success');
    }

    setGuardians(updatedList);
    storageService.saveGuardians(updatedList);
    setIsSavingGuardian(false);
    setIsGuardianModalOpen(false);
  };

  // Delete Guardian with smart orphan photo removal
  const handleDeleteGuardian = async (guardian: Guardian) => {
    if (
      confirm(
        `คุณต้องการลบผู้ปกครอง "${guardian.prefix}${guardian.firstName} ${guardian.lastName}" หรือไม่?\nระบบจะตรวจสอบหากไม่มีรายการใดใช้ไฟล์รูปภาพ "${guardian.photoFileName}" อีก จะทำการลบไฟล์ออกจาก Storage โดยอัตโนมัติ`
      )
    ) {
      const res = await storageService.deleteGuardian(guardian.id);
      if (res.success) {
        setGuardians(storageService.getGuardians());
        setCards(storageService.getCards());
        onNotify(`ลบผู้ปกครองสำเร็จ: ${res.imageStatus}`, 'info');
      }
    }
  };

  // Issue Card
  const handleIssueCard = (e?: React.FormEvent, sendToPrint: boolean = false) => {
    if (e) e.preventDefault();
    if (!cardForm.studentId || !cardForm.guardianId) {
      onNotify('กรุณาเลือกรหัสนักเรียนและผู้ปกครอง', 'error');
      return;
    }

    // Check duplicate
    const exists = cards.some(
      (c) => c.studentId === cardForm.studentId && c.guardianId === cardForm.guardianId
    );
    if (exists) {
      onNotify('นักเรียนและผู้ปกครองคู่นี้ มีบัตรรับส่งในระบบอยู่แล้ว', 'error');
      return;
    }

    const newCard: PickupCard = {
      id: `card_${cardForm.studentId}_${Date.now().toString().slice(-4)}`,
      studentId: cardForm.studentId,
      guardianId: cardForm.guardianId,
      issueDate: cardForm.issueDate,
      expiryDate: cardForm.expiryDate,
      status: 'active',
      qrCodeText: `CARD:${cardForm.studentId}:${cardForm.guardianId}:EXP-${cardForm.expiryDate}`,
      createdAt: new Date().toISOString(),
      printCount: 0,
      lastPrintedAt: null,
    };

    const updated = [newCard, ...cards];
    setCards(updated);
    storageService.saveCards(updated);
    setIsCardModalOpen(false);

    if (sendToPrint) {
      onSendCardToPrintTray(newCard.id);
      onNotify('ออกบัตรรับส่งใหม่และส่งไปยังถาดพิมพ์เรียบร้อยแล้ว', 'success');
    } else {
      onNotify('ออกบัตรรับส่งนักเรียนใหม่เรียบร้อยแล้ว', 'success');
    }
  };

  // Delete Card with smart photo check
  const handleDeleteCard = async (cardId: string) => {
    const cardToDelete = cards.find((c) => c.id === cardId);
    if (!cardToDelete) return;

    if (confirm('คุณต้องการยกเลิกและลบบัตรรับส่งใบนี้ใช่หรือไม่?')) {
      const remaining = cards.filter((c) => c.id !== cardId);
      setCards(remaining);
      storageService.saveCards(remaining);

      // Check if this guardian has any other cards left
      const guardian = guardians.find((g) => g.id === cardToDelete.guardianId);
      if (guardian && (guardian.photoFileName || guardian.photoStoragePath)) {
        const stillHasCards = remaining.some((c) => c.guardianId === guardian.id);
        if (!stillHasCards) {
          // If no cards left for this guardian, check if image is orphaned
          const photoCheck = await storageService.deletePhotoIfOrphaned(
            guardian.photoFileName,
            undefined,
            guardian.photoStoragePath
          );
          if (photoCheck.deleted) {
            onNotify(`ลบบัตรรับส่งเรียบร้อย และ${photoCheck.reason}`, 'info');
            return;
          }
        }
      }

      onNotify('ลบบัตรรับส่งนักเรียนเรียบร้อยแล้ว', 'info');
    }
  };

  // Filter cards
  const filteredCards = cards.filter((c) => {
    const s = students.find((st) => st.studentId === c.studentId);
    const g = guardians.find((gd) => gd.id === c.guardianId);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.studentId.includes(q) ||
      s?.firstName.toLowerCase().includes(q) ||
      s?.lastName.toLowerCase().includes(q) ||
      g?.firstName.toLowerCase().includes(q) ||
      g?.lastName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            ข้อมูลผู้ปกครองและบัตรรับส่ง (Many-to-Many Cards)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            นักเรียน 1 คน มีผู้ปกครองได้หลายคน • ผู้ปกครอง 1 คน ทำบัตรรับส่งได้หลายคน • จัดการรูปภาพอัจฉริยะ (Smart Storage)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'cards'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายการบัตรรับส่ง ({cards.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guardians')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'guardians'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ข้อมูลผู้ปกครอง ({guardians.length})
            </button>
          </div>

          {/* Add Guardian Button */}
          <button
            type="button"
            onClick={() => {
              setGuardianForm({
                prefix: 'นาย',
                firstName: '',
                lastName: '',
                relation: 'บิดา',
                phone: '',
                photoUrl: '',
                photoFileName: '',
                photoStoragePath: '',
                photoAssetId: '',
                selectedFile: null,
              });
              setIsGuardianModalOpen(true);
            }}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            เพิ่มผู้ปกครองใหม่
          </button>

          {/* Issue Card Button */}
          <button
            type="button"
            onClick={() => {
              if (students.length === 0 || guardians.length === 0) {
                onNotify('กรุณาเพิ่มนักเรียนและผู้ปกครองในระบบก่อนทำการออกบัตร', 'error');
                return;
              }
              const firstStudent = students[0];
              setCardForm({
                studentId: firstStudent.studentId,
                guardianId: guardians[0].id,
                issueDate: getTodayDateString(),
                expiryDate: calculateCardExpiryDate(firstStudent.entryYear),
              });
              setStudentSearchQuery('');
              setGuardianSearchQuery('');
              setIsCardModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            ออกบัตรรับส่งใหม่
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัส 5 หลัก, ชื่อนร., หรือชื่อผู้ปกครอง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
          />
        </div>
        <div className="text-xs text-slate-500">
          {activeTab === 'cards' ? `พบบัตร ${filteredCards.length} ใบ` : `พบผู้ปกครอง ${guardians.length} คน`}
        </div>
      </div>

      {/* TAB 1: PICKUP CARDS VIEW */}
      {activeTab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.length > 0 ? (
            filteredCards.map((c) => {
              const student = students.find((s) => s.studentId === c.studentId);
              const guardian = guardians.find((g) => g.id === c.guardianId);
              if (!student || !guardian) return null;

              return (
                <div
                  key={c.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Student ID Badge & Card Level */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-mono font-bold text-xs">
                        รหัส {student.studentId}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          student.level === 'มัธยมศึกษาตอนต้น'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {student.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'} (ม.{student.classroom})
                      </span>
                    </div>

                    {/* Guardian & Student Info */}
                    <div className="flex items-start gap-3 mb-4">
                      <img
                        src={storageService.resolveImageSrc(guardian.photoUrl, guardian.photoAssetId)}
                        alt={guardian.firstName}
                        className="w-16 h-20 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0"
                        onError={(e) => {
                          const fallback = storageService.getImageFallbackDataUrl(guardian.photoUrl, guardian.photoAssetId);
                          if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                      <div className="text-xs min-w-0">
                        <div className="text-[11px] text-slate-400 font-medium">ผู้ถือบัตรรับส่ง:</div>
                        <div className="font-bold text-slate-800 text-sm truncate">
                          {guardian.prefix}
                          {guardian.firstName} {guardian.lastName}
                        </div>
                        <div className="text-blue-600 font-semibold text-[11px] mb-1.5">
                          ความสัมพันธ์: {guardian.relation}
                        </div>

                        <div className="text-[11px] text-slate-400 font-medium">นักเรียน:</div>
                        <div className="text-slate-700 font-sarabun font-semibold truncate">
                          {student.prefix}
                          {student.firstName} {student.lastName} ({student.nickname})
                        </div>
                      </div>
                    </div>

                    {/* Dates & Print Count */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1 mb-4 font-sarabun text-slate-600">
                      <div className="flex justify-between">
                        <span>วันที่ออกบัตร:</span>
                        <strong className="text-slate-800">{formatThaiDateShort(c.issueDate)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>วันหมดอายุ (3 ปี):</span>
                        <strong className="text-emerald-700">{formatThaiDateShort(c.expiryDate)}</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200/60">
                        <span>ประวัติการพิมพ์:</span>
                        <span
                          className={`font-semibold ${
                            c.printCount > 0 ? 'text-blue-700' : 'text-slate-400'
                          }`}
                        >
                          พิมพ์แล้ว {c.printCount} ครั้ง
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSendCardToPrintTray(c.id)}
                      className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      ส่งพิมพ์ลงถาด EPSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="ลบบัตรใบนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs">
              ไม่พบบัตรรับส่งที่ตรงกับเงื่อนไขการค้นหา
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GUARDIANS LIST VIEW */}
      {activeTab === 'guardians' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 font-sarabun">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">รูปถ่าย</th>
                  <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4">ความสัมพันธ์</th>
                  <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                  <th className="py-3 px-4">ชื่อไฟล์รูปต้นฉบับ</th>
                  <th className="py-3 px-4">นักเรียนที่ผูกบัตรไว้</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guardians.map((g) => {
                  const linkedCards = cards.filter((c) => c.guardianId === g.id);
                  const isSharedImage = storageService.isImageReferencedByOtherGuardians(
                    g.photoFileName,
                    g.id,
                    g.photoStoragePath
                  );

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <img
                          src={storageService.resolveImageSrc(g.photoUrl, g.photoAssetId)}
                          alt={g.firstName}
                          className="w-10 h-12 object-cover rounded-md border border-slate-200"
                          onError={(e) => {
                            const fallback = storageService.getImageFallbackDataUrl(g.photoUrl, g.photoAssetId);
                            if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {g.prefix}
                        {g.firstName} {g.lastName}
                      </td>
                      <td className="py-3 px-4 text-blue-600 font-semibold">{g.relation}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{g.phone || '-'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <FileImage className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{g.photoFileName}</span>
                          {isSharedImage && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full">
                              แชร์รูป
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {linkedCards.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {linkedCards.map((c) => {
                              const s = students.find((st) => st.studentId === c.studentId);
                              return (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-mono text-[10px] font-bold"
                                >
                                  {s?.studentId} ({s?.nickname || s?.firstName})
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">ยังไม่มีบัตร</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteGuardian(g)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบผู้ปกครอง (พร้อมตรวจสอบลบรูปภาพที่ไม่มีใครใช้ออก)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Guardian Modal */}
      {isGuardianModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                เพิ่มข้อมูลผู้ปกครอง (Guardian Profile)
              </h3>
              <button
                type="button"
                onClick={() => setIsGuardianModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGuardian} className="p-5 space-y-4">
              {/* Photo Upload with original filename */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รูปถ่ายผู้ปกครอง (สำหรับแสดงบนบัตร PVC)
                </label>
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  {guardianForm.photoUrl ? (
                    <img
                      src={storageService.resolveImageSrc(guardianForm.photoUrl, guardianForm.photoAssetId)}
                      alt="Preview"
                      className="w-14 h-16 object-cover rounded-lg border border-slate-300 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs shrink-0">
                      ไม่มีรูป
                    </div>
                  )}
                  <div className="text-xs flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>อัปโหลดรูปใหม่</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsImagePickerOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>คลังรูป Firebase</span>
                      </button>
                    </div>
                    {guardianForm.photoFileName && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[220px] font-mono">
                        ไฟล์: {guardianForm.photoFileName}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Prefix, First, Last */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">คำนำหน้า</label>
                  <select
                    value={guardianForm.prefix}
                    onChange={(e) => setGuardianForm({ ...guardianForm, prefix: e.target.value })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianForm.firstName}
                    onChange={(e) => setGuardianForm({ ...guardianForm, firstName: e.target.value })}
                    placeholder="ชื่อจริง"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianForm.lastName}
                    onChange={(e) => setGuardianForm({ ...guardianForm, lastName: e.target.value })}
                    placeholder="นามสกุล"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
              </div>

              {/* Relation & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ความสัมพันธ์</label>
                  <select
                    value={guardianForm.relation}
                    onChange={(e) => setGuardianForm({ ...guardianForm, relation: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-sarabun"
                  >
                    <option value="บิดา">บิดา</option>
                    <option value="มารดา">มารดา</option>
                    <option value="ผู้ปกครอง">ผู้ปกครอง</option>
                    <option value="ปู่ / ย่า">ปู่ / ย่า</option>
                    <option value="ตา / ยาย">ตา / ยาย</option>
                    <option value="ลุง / ป้า / น้า / อา">ลุง / ป้า / น้า / อา</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={guardianForm.phone}
                    onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGuardianModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingGuardian}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSavingGuardian ? 'กำลังบีบอัดและอัปโหลดรูป...' : 'บันทึกข้อมูลผู้ปกครอง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Card Modal - Expanded with Student & Guardian Search, Info Cards, and Live Card Preview */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl xl:max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    ออกบัตรรับส่งนักเรียนใหม่ (Pair Student & Guardian)
                  </h3>
                  <p className="text-xs text-slate-500 font-sarabun">
                    ค้นหาข้อมูลนักเรียนและผู้ปกครอง ตรวจสอบความถูกต้อง พร้อมแสดงตัวอย่างหน้าบัตรจริงก่อนบันทึก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-2 rounded-xl transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              // Selected student and guardian objects
              const selectedStudent = students.find((s) => s.studentId === cardForm.studentId);
              const selectedGuardian = guardians.find((g) => g.id === cardForm.guardianId);

              // Filtered students for quick search
              const filteredStudentsForPair = students.filter((s) => {
                const q = studentSearchQuery.toLowerCase().trim();
                if (!q) return true;
                return (
                  s.studentId.includes(q) ||
                  s.firstName.toLowerCase().includes(q) ||
                  s.lastName.toLowerCase().includes(q) ||
                  (s.nickname && s.nickname.toLowerCase().includes(q)) ||
                  s.classroom.toLowerCase().includes(q) ||
                  s.level.toLowerCase().includes(q)
                );
              });

              // Filtered guardians for quick search
              const filteredGuardiansForPair = guardians.filter((g) => {
                const q = guardianSearchQuery.toLowerCase().trim();
                if (!q) return true;
                return (
                  g.firstName.toLowerCase().includes(q) ||
                  g.lastName.toLowerCase().includes(q) ||
                  g.relation.toLowerCase().includes(q) ||
                  g.phone.includes(q) ||
                  (g.photoFileName && g.photoFileName.toLowerCase().includes(q))
                );
              });

              // Existing linked cards for this student
              const existingStudentCards = selectedStudent
                ? cards.filter((c) => c.studentId === selectedStudent.studentId)
                : [];

              // Existing linked cards for this guardian
              const existingGuardianCards = selectedGuardian
                ? cards.filter((c) => c.guardianId === selectedGuardian.id)
                : [];

              // Check duplicate pairing
              const existingPairCard = cards.find(
                (c) => c.studentId === cardForm.studentId && c.guardianId === cardForm.guardianId
              );
              const isAlreadyPaired = Boolean(existingPairCard);

              // Level-specific or chosen front card design
              const autoPreviewDesign = storageService.getCardDesign(
                selectedStudent?.level || 'มัธยมศึกษาตอนต้น'
              );
              const previewDesign =
                (previewDesignId !== 'auto' &&
                  frontDesigns.find((d) => d.id === previewDesignId)) ||
                autoPreviewDesign;

              // Virtual card for live CardPreview
              const virtualCard: PickupCard = {
                id: `card_${cardForm.studentId || '00000'}_temp`,
                studentId: cardForm.studentId,
                guardianId: cardForm.guardianId,
                issueDate: cardForm.issueDate,
                expiryDate: cardForm.expiryDate,
                status: 'active',
                qrCodeText: `CARD:${cardForm.studentId}:${cardForm.guardianId}:EXP-${cardForm.expiryDate}`,
                createdAt: new Date().toISOString(),
                printCount: 0,
                lastPrintedAt: null,
              };

              return (
                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Student Search & Info, Guardian Search & Info, Dates */}
                    <div className="lg:col-span-7 space-y-5">
                      {/* 1. ค้นหาข้อมูลนักเรียน และ แสดงข้อมูลนักเรียน */}
                      <div className="p-4 bg-white rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-blue-600" />
                            <span>1. ค้นหาข้อมูลนักเรียน (Student Search)</span>
                            <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                            พบบัญชี {filteredStudentsForPair.length} / {students.length} คน
                          </span>
                        </div>

                        {/* Search Input for Student */}
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="พิมพ์ค้นหานักเรียนด้วยรหัส 5 หลัก, ชื่อ, นามสกุล, ชื่อเล่น หรือชั้น..."
                            value={studentSearchQuery}
                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                          />
                          {studentSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setStudentSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Student Dropdown / Quick Select */}
                        <div>
                          <select
                            value={cardForm.studentId}
                            onChange={(e) => {
                              const sid = e.target.value;
                              const st = students.find((s) => s.studentId === sid);
                              setCardForm({
                                ...cardForm,
                                studentId: sid,
                                expiryDate: calculateCardExpiryDate(st?.entryYear || 2569),
                              });
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-sarabun"
                          >
                            {filteredStudentsForPair.length > 0 ? (
                              filteredStudentsForPair.map((s) => (
                                <option key={s.studentId} value={s.studentId}>
                                  รหัส {s.studentId} - {s.prefix}
                                  {s.firstName} {s.lastName} {s.nickname ? `(${s.nickname})` : ''} - ม.{s.classroom} ({s.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'})
                                </option>
                              ))
                            ) : (
                              <option disabled value="">
                                ไม่พบนักเรียนที่ค้นหา
                              </option>
                            )}
                          </select>
                        </div>

                        {/* แสดงข้อมูลนักเรียนที่ถูกเลือก (Student Info Card) */}
                        {selectedStudent ? (
                          <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-xl border border-blue-200 shadow-2xs space-y-2.5 animate-in fade-in duration-100">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs shrink-0">
                                  {selectedStudent.studentId}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs text-blue-600 font-semibold">ข้อมูลนักเรียนที่เลือก:</div>
                                  <div className="text-sm font-bold text-slate-800 truncate">
                                    {selectedStudent.prefix}
                                    {selectedStudent.firstName} {selectedStudent.lastName}
                                    {selectedStudent.nickname && (
                                      <span className="text-blue-700 font-normal ml-1">
                                        ({selectedStudent.nickname})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span
                                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                        selectedStudent.level === 'มัธยมศึกษาตอนต้น'
                                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                                      }`}
                                    >
                                      {selectedStudent.level} (ม.{selectedStudent.classroom})
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-sarabun">
                                      ปีเข้าศึกษา: พ.ศ. {selectedStudent.entryYear}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 shrink-0">
                                <Check className="w-3 h-3" />
                                เลือกแล้ว
                              </span>
                            </div>

                            {/* Existing pickup cards status for this student */}
                            <div className="pt-2 border-t border-blue-200/70 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                              <span className="text-slate-500 text-[11px]">
                                บัตรรับส่งที่ผูกไว้แล้ว ({existingStudentCards.length} ใบ):
                              </span>
                              {existingStudentCards.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {existingStudentCards.map((c) => {
                                    const g = guardians.find((x) => x.id === c.guardianId);
                                    return (
                                      <span
                                        key={c.id}
                                        className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded text-[11px] font-sarabun"
                                      >
                                        {g ? `${g.prefix}${g.firstName} (${g.relation})` : c.guardianId}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-emerald-700 text-[11px] font-medium">
                                  ยังไม่มีบัตรในระบบ (นี่จะเป็นบัตรใบแรก)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                            กรุณาเลือกนักเรียน
                          </div>
                        )}
                      </div>

                      {/* 2. ค้นหาข้อมูลผู้ปกครอง และ แสดงข้อมูลผู้ปกครอง */}
                      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-blue-600" />
                            <span>2. ค้นหาข้อมูลผู้ปกครอง (Guardian Search)</span>
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                              พบบัญชี {filteredGuardiansForPair.length} / {guardians.length} คน
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setGuardianForm({
                                  prefix: 'นาย',
                                  firstName: '',
                                  lastName: '',
                                  relation: 'บิดา',
                                  phone: '',
                                  photoUrl: '',
                                  photoFileName: '',
                                  photoStoragePath: '',
                                  photoAssetId: '',
                                  selectedFile: null,
                                });
                                setIsGuardianModalOpen(true);
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Plus className="w-3 h-3" />
                              เพิ่มผู้ปกครองใหม่
                            </button>
                          </div>
                        </div>

                        {/* Search Input for Guardian */}
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="พิมพ์ค้นหาผู้ปกครองด้วยชื่อ, นามสกุล, ความสัมพันธ์, เบอร์โทร, หรือชื่อไฟล์รูป..."
                            value={guardianSearchQuery}
                            onChange={(e) => setGuardianSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                          />
                          {guardianSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setGuardianSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Guardian Dropdown / Quick Select */}
                        <div>
                          <select
                            value={cardForm.guardianId}
                            onChange={(e) => setCardForm({ ...cardForm, guardianId: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-sarabun"
                          >
                            {filteredGuardiansForPair.length > 0 ? (
                              filteredGuardiansForPair.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.prefix}
                                  {g.firstName} {g.lastName} ({g.relation} {g.phone ? `- โทร ${g.phone}` : ''})
                                </option>
                              ))
                            ) : (
                              <option disabled value="">
                                ไม่พบผู้ปกครองที่ค้นหา
                              </option>
                            )}
                          </select>
                        </div>

                        {/* แสดงข้อมูลผู้ปกครองที่ถูกเลือก (Guardian Info Card) */}
                        {selectedGuardian ? (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 animate-in fade-in duration-100">
                            <div className="flex items-start gap-3.5">
                              <img
                                src={storageService.resolveImageSrc(selectedGuardian.photoUrl, selectedGuardian.photoAssetId)}
                                alt={selectedGuardian.firstName}
                                className="w-16 h-20 object-cover rounded-xl border border-slate-300 shadow-2xs shrink-0 bg-white"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  const fallback = storageService.getImageFallbackDataUrl(selectedGuardian.photoUrl, selectedGuardian.photoAssetId);
                                  if (fallback && img.src !== fallback) {
                                    img.src = fallback;
                                    return;
                                  }
                                  img.src =
                                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" fill="%2394a3b8"><rect width="100" height="120"/><circle cx="50" cy="40" r="25" fill="%23ffffff"/><circle cx="50" cy="95" r="40" fill="%23ffffff"/></svg>';
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-slate-500 font-semibold">ข้อมูลผู้ปกครองที่เลือก:</div>
                                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    เลือกแล้ว
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-slate-800 truncate mt-0.5">
                                  {selectedGuardian.prefix}
                                  {selectedGuardian.firstName} {selectedGuardian.lastName}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-xs">
                                    ความสัมพันธ์: {selectedGuardian.relation}
                                  </span>
                                  {selectedGuardian.phone ? (
                                    <span className="text-slate-600 font-mono text-xs flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      {selectedGuardian.phone}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">ไม่มีเบอร์โทร</span>
                                  )}
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500 font-mono truncate max-w-sm flex items-center gap-1">
                                  <FileImage className="w-3 h-3 text-slate-400" />
                                  <span>ไฟล์รูปถ่าย: {selectedGuardian.photoFileName || 'guardian_photo.jpg'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Existing links for this guardian */}
                            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                              <span className="text-slate-500 text-[11px]">
                                ผูกกับนักเรียนอื่นแล้ว ({existingGuardianCards.length} คน):
                              </span>
                              {existingGuardianCards.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {existingGuardianCards.map((c) => {
                                    const s = students.find((x) => x.studentId === c.studentId);
                                    return (
                                      <span
                                        key={c.id}
                                        className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded font-mono text-[10px]"
                                      >
                                        {s ? `${s.studentId} (${s.nickname || s.firstName})` : c.studentId}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">ยังไม่มีบัตรกับนักเรียนคนอื่น</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                            กรุณาเลือกผู้ปกครอง
                          </div>
                        )}
                      </div>

                      {/* 3. Thai Date Pickers */}
                      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                        <div className="text-xs font-bold text-slate-800">
                          3. กำหนดวันที่ออกบัตรและวันหมดอายุ (Issue & Expiry Dates)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <ThaiDatePicker
                              label="วันที่ออกบัตร (ภาษาไทย พ.ศ.)"
                              value={cardForm.issueDate}
                              onChange={(val) => setCardForm({ ...cardForm, issueDate: val })}
                            />
                          </div>
                          <div>
                            <ThaiDatePicker
                              label="วันหมดอายุ (อายุบัตร 3 ปีการศึกษา)"
                              value={cardForm.expiryDate}
                              onChange={(val) => setCardForm({ ...cardForm, expiryDate: val })}
                              quickPreset3YearsEntryYear={selectedStudent?.entryYear}
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900">
                          <div className="font-semibold flex items-center gap-1.5 mb-0.5 text-blue-950">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            กฎอายุบัตร 3 ปีการศึกษา (อัตโนมัติ):
                          </div>
                          <div className="text-[11px] text-blue-800 font-sarabun leading-relaxed">
                            ระดับ ม.ต้น (ม.1 - ม.3) หรือ ม.ปลาย (ม.4 - ม.6) หมดอายุสิ้นปีการศึกษา (31 มีนาคม) ระบบจะสร้าง QR Code ตรวจสอบสิทธิ์อัตโนมัติ
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Live Card Preview & Duplicate Validation Notice */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Live Card Preview Box */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-blue-600" />
                            ตัวอย่างหน้าบัตรจริง (Real-time CR80 Preview)
                          </span>
                          <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold font-mono">
                            85.6 × 54.0 mm
                          </span>
                        </div>

                        {/* Interactive Card Canvas Wrapper */}
                        <div className="py-2 flex justify-center w-full overflow-hidden">
                          {selectedStudent && selectedGuardian ? (
                            <CardPreview
                              design={previewDesign}
                              student={selectedStudent}
                              guardian={selectedGuardian}
                              card={virtualCard}
                              scale={1.15}
                            />
                          ) : (
                            <div className="w-[324px] h-[204px] bg-slate-200 rounded-[7px] flex items-center justify-center text-slate-400 text-xs">
                              รอข้อมูลนักเรียนและผู้ปกครอง...
                            </div>
                          )}
                        </div>

                        <div className="w-full mt-3 pt-2.5 border-t border-slate-200 space-y-2">
                          <div className="text-center">
                            <span className="text-[11px] text-slate-500 font-sarabun">
                              แบบบัตรที่แสดง: <strong>{previewDesign.name || previewDesign.title}</strong>
                            </span>
                          </div>
                          {frontDesigns.length > 1 && (
                            <select
                              value={previewDesignId}
                              onChange={(e) => setPreviewDesignId(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                            >
                              <option value="auto">
                                ตัวอย่างอัตโนมัติตามระดับชั้น ({autoPreviewDesign.name || autoPreviewDesign.title})
                              </option>
                              {frontDesigns.map((d) => (
                                <option key={d.id} value={d.id}>
                                  [{d.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'}] {d.name || d.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Duplicate Validation Status Card */}
                      {isAlreadyPaired ? (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-900 space-y-2 animate-in fade-in duration-100">
                          <div className="font-bold text-xs flex items-center gap-2 text-amber-950">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            มีบัตรรับส่งคู่นี้ในระบบแล้ว (Duplicate Card)
                          </div>
                          <p className="text-[11px] text-amber-800 font-sarabun leading-relaxed">
                            นักเรียนรหัส <strong>{selectedStudent?.studentId}</strong> และผู้ปกครอง <strong>{selectedGuardian?.firstName} {selectedGuardian?.lastName}</strong> ได้ถูกออกบัตรรับส่งแล้ว (รหัสบัตร: <span className="font-mono">{existingPairCard?.id}</span> เมื่อ {formatThaiDateShort(existingPairCard?.issueDate || '')})
                          </p>
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (existingPairCard) {
                                  setIsCardModalOpen(false);
                                  onSendCardToPrintTray(existingPairCard.id);
                                }
                              }}
                              className="w-full py-2 px-3 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl border border-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              เปิดดูและส่งพิมพ์บัตรเดิมนี้ลงถาด
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
                          <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-950">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            ข้อมูลสมบูรณ์ พร้อมออกบัตรรับส่งใหม่
                          </div>
                          <p className="text-[11px] text-emerald-800 font-sarabun">
                            เมื่อยืนยัน ระบบจะสร้างความสัมพันธ์ ออกรหัสบัตร และสร้าง QR Code สำหรับตรวจสอบสิทธิ์โดยอัตโนมัติ
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            {(() => {
              const selectedStudent = students.find((s) => s.studentId === cardForm.studentId);
              const selectedGuardian = guardians.find((g) => g.id === cardForm.guardianId);
              const isAlreadyPaired = cards.some(
                (c) => c.studentId === cardForm.studentId && c.guardianId === cardForm.guardianId
              );
              const canSubmit = Boolean(selectedStudent && selectedGuardian && !isAlreadyPaired);

              return (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-sarabun text-center sm:text-left">
                    {selectedStudent && selectedGuardian ? (
                      <span>
                        จับคู่: <strong className="text-slate-800">รหัส {selectedStudent.studentId} ({selectedStudent.firstName})</strong> ↔ <strong className="text-blue-700">{selectedGuardian.prefix}{selectedGuardian.firstName} ({selectedGuardian.relation})</strong>
                      </span>
                    ) : (
                      <span>กรุณาเลือกนักเรียนและผู้ปกครอง</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsCardModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>

                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => handleIssueCard(undefined, false)}
                      className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        canSubmit
                          ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      บันทึกออกบัตรรับส่ง
                    </button>

                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => handleIssueCard(undefined, true)}
                      className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        canSubmit
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      title="บันทึกบัตรและเปิดหน้าถาดพิมพ์ทันที"
                    >
                      <Printer className="w-4 h-4" />
                      ออกบัตรและส่งพิมพ์ลงถาดทันที
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      <FirebaseImagePickerModal
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        initialCategory="guardian_photo"
        title="เลือกไฟล์รูปถ่ายผู้ปกครองจากฐานข้อมูล Firebase"
        onNotify={onNotify}
        onSelect={(asset) => {
          setGuardianForm((prev) => ({
            ...prev,
            photoUrl: asset.storageUrl || `firestore-asset://${asset.id}`,
            photoFileName: asset.fileName,
            photoStoragePath: asset.storagePath || '',
            photoAssetId: asset.id,
            selectedFile: null,
          }));
          onNotify(`เลือกรูป "${asset.fileName}" จากฐานข้อมูล Firebase แล้ว`, 'success');
        }}
      />
    </div>
  );
};
