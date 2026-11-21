import React, { useState, useEffect, useMemo } from 'react';
import { Guardian, PickupCard, Student, CardDesignConfig, EducationLevel } from '../types';
import { storageService } from '../utils/storage';
import { formatFileSize, precompressAvatarPhoto } from '../utils/imageOptimizer';
import {
  formatThaiDateShort,
  getTodayDateString,
  calculateCardExpiryDate,
  calculateCurrentGrade,
  getCurrentBuddhistYear,
  formatStudentGradeRoom,
} from '../utils/thaiDate';
import { ThaiDatePicker } from './ThaiDatePicker';
import { CardPreview } from './CardPreview';
import { FirebaseImagePickerModal } from './FirebaseImagePickerModal';
import { GUARDIAN_RELATION_ORDER } from '../utils/relations';
import {
  UserCheck,
  CreditCard,
  Plus,
  Trash2,
  Printer,
  Search,
  Upload,
  CheckCircle,
  AlertCircle,
  FileImage,
  GraduationCap,
  Phone,
  X,
  Eye,
  Check,
  FolderOpen,
  LayoutGrid,
  List,
  Edit2,
  ArrowLeft,
  ArrowRight,
  Highlighter,
  Eraser,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
} from 'lucide-react';

interface GuardiansViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSendCardToPrintTray: (cardId: string, designId?: string) => void;
  editCardTarget?: { cardId: string; nonce: number } | null;
  onEditCardTargetHandled?: () => void;
}

export const GuardiansView: React.FC<GuardiansViewProps> = ({
  onNotify,
  onSendCardToPrintTray,
  editCardTarget,
  onEditCardTargetHandled,
}) => {
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear() || getCurrentBuddhistYear()
  );
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [frontDesigns, setFrontDesigns] = useState<CardDesignConfig[]>(() =>
    storageService.getFrontDesigns()
  );
  const [isSavingGuardian, setIsSavingGuardian] = useState<boolean>(false);

  useEffect(() => {
    return storageService.subscribe(() => {
      setCurrentAcademicYear(storageService.getAcademicYear() || getCurrentBuddhistYear());
      setGuardians(storageService.getGuardians());
      setStudents(storageService.getStudents());
      setCards(storageService.getCards());
      setFrontDesigns(storageService.getFrontDesigns());
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'cards' | 'guardians'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cardViewMode, setCardViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('spcard_cards_view_mode');
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [cardPrintFilter, setCardPrintFilter] = useState<'all' | 'unprinted' | 'printed'>('all');
  const [cardsPage, setCardsPage] = useState<number>(1);
  const [cardsPageSize, setCardsPageSize] = useState<number>(20);
  const [guardiansPage, setGuardiansPage] = useState<number>(1);
  const [guardiansPageSize, setGuardiansPageSize] = useState<number>(20);

  // Row highlight tracking: printed cards (printCount > 0) are highlighted unless unhighlighted at that printCount
  const [unhighlightedPrintCounts, setUnhighlightedPrintCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('spcard_unhighlighted_cards_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [manualHighlightedIds, setManualHighlightedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('spcard_manual_highlighted_cards_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('spcard_cards_view_mode', cardViewMode);
    } catch {
      // ignore
    }
  }, [cardViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('spcard_unhighlighted_cards_v1', JSON.stringify(unhighlightedPrintCounts));
    } catch {
      // ignore
    }
  }, [unhighlightedPrintCounts]);

  useEffect(() => {
    try {
      localStorage.setItem('spcard_manual_highlighted_cards_v1', JSON.stringify(manualHighlightedIds));
    } catch {
      // ignore
    }
  }, [manualHighlightedIds]);

  const isCardRowHighlighted = (card: PickupCard): boolean => {
    if (manualHighlightedIds.includes(card.id)) return true;
    if (card.printCount > 0) {
      const dismissedCount = unhighlightedPrintCounts[card.id];
      return dismissedCount === undefined || card.printCount > dismissedCount;
    }
    return false;
  };

  const handleToggleRowHighlight = (card: PickupCard) => {
    const currentlyHighlighted = isCardRowHighlighted(card);
    if (currentlyHighlighted) {
      setManualHighlightedIds((prev) => prev.filter((id) => id !== card.id));
      if (card.printCount > 0) {
        setUnhighlightedPrintCounts((prev) => ({
          ...prev,
          [card.id]: card.printCount,
        }));
      }
      onNotify('ยกเลิกการไฮไลท์สีแถวเรียบร้อยแล้ว', 'info');
    } else {
      setUnhighlightedPrintCounts((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
      if (card.printCount === 0) {
        setManualHighlightedIds((prev) => Array.from(new Set([...prev, card.id])));
      }
      onNotify('เปิดการไฮไลท์สีแถวเรียบร้อยแล้ว', 'success');
    }
  };

  const handleClearAllHighlights = () => {
    const nextDismissed: Record<string, number> = { ...unhighlightedPrintCounts };
    cards.forEach((c) => {
      if (c.printCount > 0) {
        nextDismissed[c.id] = c.printCount;
      }
    });
    setUnhighlightedPrintCounts(nextDismissed);
    setManualHighlightedIds([]);
    onNotify('ยกเลิกการไฮไลท์สีแถวทั้งหมดเรียบร้อยแล้ว', 'info');
  };

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

  // Quick Edit Student Modal (reachable from Pair modal)
  const [isStudentEditModalOpen, setIsStudentEditModalOpen] = useState<boolean>(false);
  const [studentEditForm, setStudentEditForm] = useState<{
    studentId: string;
    prefix: string;
    firstName: string;
    lastName: string;
    nickname: string;
    level: EducationLevel;
    classroom: string;
    entryYear: number;
  }>({
    studentId: '',
    prefix: 'เด็กชาย',
    firstName: '',
    lastName: '',
    nickname: '',
    level: 'มัธยมศึกษาตอนต้น',
    classroom: '1',
    entryYear: getCurrentBuddhistYear(),
  });

  // Issue / Edit Card Modal (Many-to-Many Linking) - starts unpaired!
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [pairStep, setPairStep] = useState<1 | 2 | 3>(1);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [guardianSearchQuery, setGuardianSearchQuery] = useState<string>('');
  const [cardForm, setCardForm] = useState<{
    studentId: string;
    guardianId: string;
    issueDate: string;
    expiryDate: string;
    frontDesignId: string;
  }>({
    studentId: '',
    guardianId: '',
    issueDate: getTodayDateString(),
    expiryDate: calculateCardExpiryDate(storageService.getAcademicYear() || getCurrentBuddhistYear()),
    frontDesignId: '',
  });

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
    const cleanText = (val: string, maxLen: number) =>
      val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);

    const cleanFirstName = cleanText(guardianForm.firstName, 120);
    const cleanLastName = cleanText(guardianForm.lastName, 120);
    const cleanPhone = cleanText(guardianForm.phone, 40);

    if (!cleanFirstName || !cleanLastName) {
      onNotify('กรุณาระบุชื่อและนามสกุลผู้ปกครอง', 'error');
      return;
    }

    if (cleanPhone && !/^[0-9+\-\s(),.ต่อextEXT]+$/.test(cleanPhone)) {
      onNotify('เบอร์โทรศัพท์ควรประกอบด้วยตัวเลขหรือเครื่องหมาย - + ( ) เท่านั้น', 'error');
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
      prefix: cleanText(guardianForm.prefix, 50),
      firstName: cleanFirstName,
      lastName: cleanLastName,
      relation: cleanText(guardianForm.relation, 80) || 'ผู้ปกครอง',
      phone: cleanPhone,
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

  // Open Guardian Edit modal
  const handleOpenEditGuardian = (guardian: Guardian) => {
    setGuardianForm({
      id: guardian.id,
      prefix: guardian.prefix,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      relation: guardian.relation,
      phone: guardian.phone || '',
      photoUrl: guardian.photoUrl || '',
      photoFileName: guardian.photoFileName || '',
      photoStoragePath: guardian.photoStoragePath || '',
      photoAssetId: guardian.photoAssetId || '',
      selectedFile: null,
    });
    setIsGuardianModalOpen(true);
  };

  // Open Student Edit modal (from Pair modal)
  const handleOpenEditStudent = (student: Student) => {
    setStudentEditForm({
      studentId: student.studentId,
      prefix: student.prefix,
      firstName: student.firstName,
      lastName: student.lastName,
      nickname: student.nickname || '',
      level: student.level,
      classroom: student.classroom,
      entryYear: student.entryYear,
    });
    setIsStudentEditModalOpen(true);
  };

  const handleSaveStudentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = (val: string, maxLen: number) =>
      val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);

    const cleanFirstName = cleanText(studentEditForm.firstName, 120);
    const cleanLastName = cleanText(studentEditForm.lastName, 120);
    if (!cleanFirstName || !cleanLastName) {
      onNotify('กรุณาระบุชื่อและนามสกุลนักเรียน', 'error');
      return;
    }

    const rawYear = Number(studentEditForm.entryYear);
    const cleanEntryYear = Number.isFinite(rawYear)
      ? Math.min(2700, Math.max(2500, Math.round(rawYear)))
      : getCurrentBuddhistYear();

    const nowIso = new Date().toISOString();
    const updatedStudents = students.map((s) =>
      s.studentId === studentEditForm.studentId
        ? {
            ...s,
            prefix: cleanText(studentEditForm.prefix, 50),
            firstName: cleanFirstName,
            lastName: cleanLastName,
            nickname: cleanText(studentEditForm.nickname, 80),
            level: studentEditForm.level,
            classroom: cleanText(studentEditForm.classroom, 30) || '1',
            entryYear: cleanEntryYear,
            updatedAt: nowIso,
          }
        : s
    );

    setStudents(updatedStudents);
    storageService.saveStudents(updatedStudents);
    setIsStudentEditModalOpen(false);
    onNotify(`อัปเดตข้อมูลนักเรียน ${studentEditForm.studentId} เรียบร้อยแล้ว`, 'success');
  };

  // Open Pair modal for new card (never auto-pairs)
  const handleOpenNewCardModal = () => {
    if (students.length === 0 || guardians.length === 0) {
      onNotify('กรุณาเพิ่มนักเรียนและผู้ปกครองในระบบก่อนทำการออกบัตร', 'error');
      return;
    }
    const academicYear = storageService.getAcademicYear() || getCurrentBuddhistYear();
    setEditingCardId(null);
    setPairStep(1);
    setCardForm({
      studentId: '',
      guardianId: '',
      issueDate: getTodayDateString(),
      expiryDate: calculateCardExpiryDate(academicYear),
      frontDesignId: '',
    });
    setStudentSearchQuery('');
    setGuardianSearchQuery('');
    setIsCardModalOpen(true);
  };

  // Open Pair modal to edit an existing card
  const handleOpenEditCardModal = (card: PickupCard) => {
    const validFrontDesignId =
      card.frontDesignId && frontDesigns.some((d) => d.id === card.frontDesignId)
        ? card.frontDesignId
        : '';
    setEditingCardId(card.id);
    setPairStep(1);
    setCardForm({
      studentId: card.studentId,
      guardianId: card.guardianId,
      issueDate: card.issueDate,
      expiryDate: card.expiryDate,
      frontDesignId: validFrontDesignId,
    });
    setStudentSearchQuery('');
    setGuardianSearchQuery('');
    setIsCardModalOpen(true);
  };

  useEffect(() => {
    if (!editCardTarget) return;
    const targetCard =
      cards.find((c) => c.id === editCardTarget.cardId) ||
      storageService.getCards().find((c) => c.id === editCardTarget.cardId);
    if (targetCard) {
      const validFrontDesignId =
        targetCard.frontDesignId && frontDesigns.some((d) => d.id === targetCard.frontDesignId)
          ? targetCard.frontDesignId
          : '';
      setActiveTab('cards');
      setEditingCardId(targetCard.id);
      setPairStep(1);
      setCardForm({
        studentId: targetCard.studentId,
        guardianId: targetCard.guardianId,
        issueDate: targetCard.issueDate,
        expiryDate: targetCard.expiryDate,
        frontDesignId: validFrontDesignId,
      });
      setStudentSearchQuery('');
      setGuardianSearchQuery('');
      setIsCardModalOpen(true);
    } else {
      onNotify('ไม่พบข้อมูลบัตรรับส่งที่ต้องการแก้ไข', 'error');
    }
    onEditCardTargetHandled?.();
  }, [editCardTarget]);

  // Issue or Update Card
  const handleIssueCard = (e?: React.FormEvent, sendToPrint: boolean = false) => {
    if (e) e.preventDefault();

    const chosenFrontDesignId =
      cardForm.frontDesignId && frontDesigns.some((d) => d.id === cardForm.frontDesignId)
        ? cardForm.frontDesignId
        : '';
    const hasValidDates = Boolean(cardForm.issueDate.trim() && cardForm.expiryDate.trim());
    const validGuardian = guardians.some((g) => g.id === cardForm.guardianId);
    const validStudent = students.some((s) => s.studentId === cardForm.studentId);

    if (!chosenFrontDesignId) {
      onNotify('กรุณาเลือกแม่แบบหน้าบัตรสำหรับพิมพ์ให้เรียบร้อยก่อนบันทึก (ขั้นตอนที่ 1)', 'error');
      setPairStep(1);
      return;
    }
    if (!hasValidDates) {
      onNotify('กรุณากำหนดวันที่ออกบัตรและวันหมดอายุให้ครบถ้วน (ขั้นตอนที่ 1)', 'error');
      setPairStep(1);
      return;
    }
    if (cardForm.expiryDate < cardForm.issueDate) {
      onNotify('วันหมดอายุต้องไม่น้อยกว่าวันที่ออกบัตร (ขั้นตอนที่ 1)', 'error');
      setPairStep(1);
      return;
    }
    if (!validGuardian) {
      onNotify('กรุณาเลือกข้อมูลผู้ปกครองให้ครบถ้วนก่อนบันทึก (ขั้นตอนที่ 2)', 'error');
      setPairStep(2);
      return;
    }
    if (!validStudent) {
      onNotify('กรุณาเลือกข้อมูลนักเรียนให้ครบถ้วนก่อนบันทึก (ขั้นตอนที่ 3)', 'error');
      setPairStep(3);
      return;
    }

    // Check duplicate (exclude currently editing card)
    const exists = cards.some(
      (c) =>
        c.id !== editingCardId &&
        c.studentId === cardForm.studentId &&
        c.guardianId === cardForm.guardianId
    );
    if (exists) {
      onNotify('นักเรียนและผู้ปกครองคู่นี้ มีบัตรรับส่งในระบบอยู่แล้ว', 'error');
      return;
    }

    let targetCardId = '';

    if (editingCardId) {
      const existingCard = cards.find((c) => c.id === editingCardId);
      if (!existingCard) return;

      const samePair =
        existingCard.studentId === cardForm.studentId &&
        existingCard.guardianId === cardForm.guardianId;

      if (samePair) {
        const updatedCard: PickupCard = {
          ...existingCard,
          issueDate: cardForm.issueDate,
          expiryDate: cardForm.expiryDate,
          qrCodeText: `CARD:${cardForm.studentId}:${cardForm.guardianId}:EXP-${cardForm.expiryDate}`,
          frontDesignId: chosenFrontDesignId,
          updatedAt: new Date().toISOString(),
        };
        const updated = cards.map((c) => (c.id === editingCardId ? updatedCard : c));
        setCards(updated);
        storageService.saveCards(updated);
        targetCardId = updatedCard.id;
      } else {
        // Pair changed: create new card doc & remove old doc to respect Firestore studentId/guardianId immutability rules
        const replacedCard: PickupCard = {
          id: `card_${cardForm.studentId}_${Date.now().toString().slice(-4)}`,
          studentId: cardForm.studentId,
          guardianId: cardForm.guardianId,
          issueDate: cardForm.issueDate,
          expiryDate: cardForm.expiryDate,
          status: existingCard.status,
          qrCodeText: `CARD:${cardForm.studentId}:${cardForm.guardianId}:EXP-${cardForm.expiryDate}`,
          frontDesignId: chosenFrontDesignId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          printCount: existingCard.printCount,
          lastPrintedAt: existingCard.lastPrintedAt,
        };
        const updated = [replacedCard, ...cards.filter((c) => c.id !== editingCardId)];
        setCards(updated);
        storageService.saveCards(updated);
        targetCardId = replacedCard.id;
      }

      setIsCardModalOpen(false);
      setEditingCardId(null);

      if (sendToPrint) {
        onSendCardToPrintTray(targetCardId, chosenFrontDesignId || undefined);
        onNotify('บันทึกการแก้ไขบัตรและส่งไปยังถาดพิมพ์เรียบร้อยแล้ว', 'success');
      } else {
        onNotify('บันทึกการแก้ไขข้อมูลบัตรรับส่งเรียบร้อยแล้ว', 'success');
      }
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
      frontDesignId: chosenFrontDesignId,
      createdAt: new Date().toISOString(),
      printCount: 0,
      lastPrintedAt: null,
    };

    const updated = [newCard, ...cards];
    setCards(updated);
    storageService.saveCards(updated);
    setIsCardModalOpen(false);
    targetCardId = newCard.id;

    if (sendToPrint) {
      onSendCardToPrintTray(targetCardId, chosenFrontDesignId || undefined);
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

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [students]);

  const guardianMap = useMemo(() => {
    const map = new Map<string, Guardian>();
    guardians.forEach((g) => map.set(g.id, g));
    return map;
  }, [guardians]);

  // Filter cards
  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cards.filter((c) => {
      const s = studentMap.get(c.studentId);
      const g = guardianMap.get(c.guardianId);
      if (!s || !g) return false;

      if (cardPrintFilter === 'printed' && c.printCount === 0) return false;
      if (cardPrintFilter === 'unprinted' && c.printCount > 0) return false;

      if (!q) return true;
      return (
        c.studentId.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        (s.nickname && s.nickname.toLowerCase().includes(q)) ||
        s.classroom.toLowerCase().includes(q) ||
        formatStudentGradeRoom(s, currentAcademicYear).toLowerCase().includes(q) ||
        g.firstName.toLowerCase().includes(q) ||
        g.lastName.toLowerCase().includes(q) ||
        g.relation.toLowerCase().includes(q)
      );
    });
  }, [cards, studentMap, guardianMap, cardPrintFilter, searchQuery, currentAcademicYear]);

  const filteredGuardians = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return guardians;
    return guardians.filter(
      (g) =>
        g.firstName.toLowerCase().includes(q) ||
        g.lastName.toLowerCase().includes(q) ||
        g.relation.toLowerCase().includes(q) ||
        (g.phone && g.phone.toLowerCase().includes(q))
    );
  }, [guardians, searchQuery]);

  const highlightedCardsCount = useMemo(
    () => filteredCards.filter((c) => isCardRowHighlighted(c)).length,
    [filteredCards, unhighlightedPrintCounts, manualHighlightedIds]
  );

  const printedCardsCount = useMemo(
    () => cards.filter((c) => c.printCount > 0).length,
    [cards]
  );

  // Reset pagination when search/filters/pageSize change
  useEffect(() => {
    setCardsPage(1);
  }, [searchQuery, cardPrintFilter, cardsPageSize]);

  useEffect(() => {
    setGuardiansPage(1);
  }, [searchQuery, guardiansPageSize]);

  // Cards pagination
  const totalCardsCount = filteredCards.length;
  const totalCardsPages = Math.max(1, Math.ceil(totalCardsCount / cardsPageSize));
  const safeCardsPage = Math.min(cardsPage, totalCardsPages);

  useEffect(() => {
    if (cardsPage > totalCardsPages) {
      setCardsPage(totalCardsPages);
    }
  }, [cardsPage, totalCardsPages]);

  const cardsStartIndex = (safeCardsPage - 1) * cardsPageSize;
  const cardsEndIndex = Math.min(cardsStartIndex + cardsPageSize, totalCardsCount);
  const paginatedCards = useMemo(
    () => filteredCards.slice(cardsStartIndex, cardsEndIndex),
    [filteredCards, cardsStartIndex, cardsEndIndex]
  );

  // Guardians pagination
  const totalGuardiansCount = filteredGuardians.length;
  const totalGuardiansPages = Math.max(1, Math.ceil(totalGuardiansCount / guardiansPageSize));
  const safeGuardiansPage = Math.min(guardiansPage, totalGuardiansPages);

  useEffect(() => {
    if (guardiansPage > totalGuardiansPages) {
      setGuardiansPage(totalGuardiansPages);
    }
  }, [guardiansPage, totalGuardiansPages]);

  const guardiansStartIndex = (safeGuardiansPage - 1) * guardiansPageSize;
  const guardiansEndIndex = Math.min(guardiansStartIndex + guardiansPageSize, totalGuardiansCount);
  const paginatedGuardians = useMemo(
    () => filteredGuardians.slice(guardiansStartIndex, guardiansEndIndex),
    [filteredGuardians, guardiansStartIndex, guardiansEndIndex]
  );

  const buildPaginationItems = (
    page: number,
    totalPages: number
  ): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return [1, 2, 3, 4, 'ellipsis-right', totalPages];
    }
    if (page >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', totalPages];
  };

  const renderPaginationBar = ({
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
    pageSize,
    unitLabel,
    onPageChange,
    onPageSizeChange,
    className = '',
  }: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    startIndex: number;
    endIndex: number;
    pageSize: number;
    unitLabel: string;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    className?: string;
  }) => {
    if (totalCount === 0) return null;
    const pageItems = buildPaginationItems(currentPage, totalPages);

    return (
      <div
        className={`px-4 py-3 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-sarabun">
          <span>
            แสดง{' '}
            <strong className="text-slate-800">
              {startIndex + 1}–{endIndex}
            </strong>{' '}
            จาก <strong className="text-slate-800">{totalCount}</strong> {unitLabel} (หน้า{' '}
            <strong className="text-slate-800">{currentPage}</strong> / {totalPages})
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">แสดงหน้าละ</span>
            <select
              aria-label={`จำนวน${unitLabel}ต่อหน้า`}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500">{unitLabel}</span>
          </div>
        </div>

        <nav aria-label={`ตัวแบ่งหน้า${unitLabel}`} className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            title="หน้าแรก"
            aria-label="หน้าแรก"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            title="หน้าก่อนหน้า"
            aria-label="หน้าก่อนหน้า"
            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-xs font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">ก่อนหน้า</span>
          </button>

          <div className="flex items-center gap-1 mx-1">
            {pageItems.map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-label={`หน้า ${item}`}
                  aria-current={item === currentPage ? 'page' : undefined}
                  className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    item === currentPage
                      ? 'bg-blue-600 text-white shadow-xs border border-blue-600'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="px-1.5 text-xs text-slate-400 select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              )
            )}
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            title="หน้าถัดไป"
            aria-label="หน้าถัดไป"
            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-xs font-medium"
          >
            <span className="hidden md:inline">ถัดไป</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="หน้าสุดท้าย"
            aria-label="หน้าสุดท้าย"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            ข้อมูลผู้ปกครองและบัตรรับส่ง (Many-to-Many Cards)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            นักเรียน 1 คน มีผู้ปกครองได้หลายคน • ผู้ปกครอง 1 คน ทำบัตรรับส่งได้หลายคน • จัดการรูปภาพอัจฉริยะ (Smart Storage)
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
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
            onClick={handleOpenNewCardModal}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ออกบัตรรับส่งใหม่
          </button>
        </div>
      </div>

      {/* Search Bar & View Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัส 5 หลัก, ชื่อนร., ห้อง หรือชื่อผู้ปกครอง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
          {activeTab === 'cards' && (
            <>
              {/* Print status filter */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setCardPrintFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    cardPrintFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  ทั้งหมด ({cards.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCardPrintFilter('unprinted')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    cardPrintFilter === 'unprinted'
                      ? 'bg-white text-slate-800 shadow-xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  ยังไม่พิมพ์ ({cards.length - printedCardsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCardPrintFilter('printed')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    cardPrintFilter === 'printed'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  พิมพ์แล้ว ({printedCardsCount})
                </button>
              </div>

              {/* Clear all highlights */}
              {highlightedCardsCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHighlights}
                  className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ยกเลิกการไฮไลท์สีแถวของบัตรที่พิมพ์แล้วทั้งหมด"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  ยกเลิกไฮไลท์ทั้งหมด ({highlightedCardsCount})
                </button>
              )}

              {/* View Mode Switcher (Grid vs List) */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setCardViewMode('grid')}
                  className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    cardViewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="แสดงแบบการ์ด"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>การ์ด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardViewMode('list')}
                  className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    cardViewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="แสดงแบบ List ข้อมูล"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>รายการ (List)</span>
                </button>
              </div>
            </>
          )}

          <div className="text-xs text-slate-500 font-sarabun">
            {activeTab === 'cards'
              ? `พบบัตร ${filteredCards.length} ใบ`
              : `พบผู้ปกครอง ${filteredGuardians.length} คน`}
          </div>
        </div>
      </div>

      {/* TAB 1: PICKUP CARDS VIEW */}
      {activeTab === 'cards' && cardViewMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedCards.length > 0 ? (
              paginatedCards.map((c) => {
              const student = studentMap.get(c.studentId);
              const guardian = guardianMap.get(c.guardianId);
              if (!student || !guardian) return null;
              const isHighlighted = isCardRowHighlighted(c);

              return (
                <div
                  key={c.id}
                  className={`p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isHighlighted
                      ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  <div>
                    {/* Header: Student ID Badge & Card Level */}
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-mono font-bold text-xs">
                          รหัส {student.studentId}
                        </span>
                        {c.printCount > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-bold">
                            พิมพ์แล้ว
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          student.level === 'มัธยมศึกษาตอนต้น'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {student.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'} ({formatStudentGradeRoom(student, currentAcademicYear)})
                      </span>
                    </div>

                    {/* Guardian & Student Info */}
                    <div className="flex items-start gap-3 mb-4">
                      <img
                        src={storageService.resolveImageSrc(guardian.photoUrl, guardian.photoAssetId)}
                        alt={guardian.firstName}
                        className="w-16 h-20 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0 bg-white"
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
                          {student.firstName} {student.lastName} {student.nickname ? `(${student.nickname})` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Dates & Print Count */}
                    <div
                      className={`p-2.5 rounded-xl border text-[11px] space-y-1 mb-4 font-sarabun text-slate-600 ${
                        isHighlighted
                          ? 'bg-white/80 border-emerald-200'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>วันที่ออกบัตร:</span>
                        <strong className="text-slate-800">{formatThaiDateShort(c.issueDate)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>วันหมดอายุ:</span>
                        <strong className="text-emerald-700">{formatThaiDateShort(c.expiryDate)}</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200/60">
                        <span>ประวัติการพิมพ์:</span>
                        <span
                          className={`font-semibold ${
                            c.printCount > 0 ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          พิมพ์แล้ว {c.printCount} ครั้ง
                        </span>
                      </div>
                      {(() => {
                        const assignedDesign = c.frontDesignId
                          ? frontDesigns.find((d) => d.id === c.frontDesignId)
                          : undefined;
                        if (!assignedDesign) return null;
                        return (
                          <div className="flex justify-between gap-2 pt-1 border-t border-slate-200/60">
                            <span className="shrink-0">แม่แบบบัตร:</span>
                            <span className="font-semibold text-blue-700 truncate">
                              {assignedDesign.name || assignedDesign.title}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => onSendCardToPrintTray(c.id, c.frontDesignId)}
                      className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      กดพิมพ์บัตร
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleRowHighlight(c)}
                      className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                          : 'text-slate-500 bg-white hover:text-emerald-700 hover:bg-emerald-50 border-slate-200'
                      }`}
                      title={isHighlighted ? 'ยกเลิกการไฮไลท์สี' : 'ไฮไลท์สีบัตรนี้'}
                    >
                      {isHighlighted ? <Eraser className="w-4 h-4" /> : <Highlighter className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCardModal(c)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      title="แก้ไขข้อมูลบัตร"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
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

          {totalCardsCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              {renderPaginationBar({
                currentPage: safeCardsPage,
                totalPages: totalCardsPages,
                totalCount: totalCardsCount,
                startIndex: cardsStartIndex,
                endIndex: cardsEndIndex,
                pageSize: cardsPageSize,
                unitLabel: 'ใบ',
                onPageChange: setCardsPage,
                onPageSizeChange: setCardsPageSize,
                className: 'border-t-0',
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1 (LIST VIEW): PICKUP CARDS TABLE WITH FULL-ROW HIGHLIGHT */}
      {activeTab === 'cards' && cardViewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 font-sarabun">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">รูปถ่าย</th>
                  <th className="py-3 px-4">รหัส / ข้อมูลนักเรียน</th>
                  <th className="py-3 px-4">ผู้ปกครอง (ผู้ถือบัตร)</th>
                  <th className="py-3 px-4">วันออกบัตร - หมดอายุ</th>
                  <th className="py-3 px-4">สถานะการพิมพ์</th>
                  <th className="py-3 px-4 text-center">จัดการ / พิมพ์บัตร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCards.length > 0 ? (
                  paginatedCards.map((c) => {
                    const student = studentMap.get(c.studentId);
                    const guardian = guardianMap.get(c.guardianId);
                    if (!student || !guardian) return null;
                    const isHighlighted = isCardRowHighlighted(c);

                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${
                          isHighlighted
                            ? 'bg-emerald-100/75 hover:bg-emerald-100'
                            : 'bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <td
                          className={`py-3 px-4 ${
                            isHighlighted ? 'shadow-[inset_4px_0_0_0_#10b981]' : ''
                          }`}
                        >
                          <img
                            src={storageService.resolveImageSrc(guardian.photoUrl, guardian.photoAssetId)}
                            alt={guardian.firstName}
                            className="w-10 h-12 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                            onError={(e) => {
                              const fallback = storageService.getImageFallbackDataUrl(
                                guardian.photoUrl,
                                guardian.photoAssetId
                              );
                              if (fallback && e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[11px]">
                              {student.studentId}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                student.level === 'มัธยมศึกษาตอนต้น'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {student.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'} • {formatStudentGradeRoom(student, currentAcademicYear)}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800">
                            {student.prefix}
                            {student.firstName} {student.lastName}
                            {student.nickname && (
                              <span className="text-slate-500 font-normal ml-1">
                                ({student.nickname})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            {guardian.prefix}
                            {guardian.firstName} {guardian.lastName}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px]">
                            <span className="text-blue-700 font-semibold">{guardian.relation}</span>
                            {guardian.phone && (
                              <span className="text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {guardian.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                          <div>
                            ออกบัตร: <strong className="text-slate-800">{formatThaiDateShort(c.issueDate)}</strong>
                          </div>
                          <div>
                            หมดอายุ: <strong className="text-emerald-700">{formatThaiDateShort(c.expiryDate)}</strong>
                          </div>
                          {(() => {
                            const assignedDesign = c.frontDesignId
                              ? frontDesigns.find((d) => d.id === c.frontDesignId)
                              : undefined;
                            if (!assignedDesign) return null;
                            return (
                              <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 text-[10px] font-semibold max-w-[170px] truncate">
                                <Layers className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{assignedDesign.name || assignedDesign.title}</span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {c.printCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
                              <CheckCircle className="w-3 h-3" />
                              พิมพ์แล้ว ({c.printCount} ครั้ง)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              ยังไม่พิมพ์
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onSendCardToPrintTray(c.id, c.frontDesignId)}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              กดพิมพ์บัตร
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleRowHighlight(c)}
                              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-xl border flex items-center gap-1 transition-colors cursor-pointer ${
                                isHighlighted
                                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                                  : 'text-slate-600 bg-white hover:text-emerald-700 hover:bg-emerald-50 border-slate-200'
                              }`}
                              title={isHighlighted ? 'ยกเลิกการไฮไลท์สีแถว' : 'ไฮไลท์สีแถวนี้'}
                            >
                              {isHighlighted ? (
                                <>
                                  <Eraser className="w-3.5 h-3.5" />
                                  <span>ยกเลิกไฮไลท์</span>
                                </>
                              ) : (
                                <>
                                  <Highlighter className="w-3.5 h-3.5" />
                                  <span>ไฮไลท์แถว</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditCardModal(c)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer"
                              title="แก้ไขข้อมูลบัตร"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCard(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer"
                              title="ลบบัตรใบนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      ไม่พบบัตรรับส่งที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationBar({
            currentPage: safeCardsPage,
            totalPages: totalCardsPages,
            totalCount: totalCardsCount,
            startIndex: cardsStartIndex,
            endIndex: cardsEndIndex,
            pageSize: cardsPageSize,
            unitLabel: 'ใบ',
            onPageChange: setCardsPage,
            onPageSizeChange: setCardsPageSize,
          })}
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
                {paginatedGuardians.length > 0 ? (
                  paginatedGuardians.map((g) => {
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
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditGuardian(g)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลผู้ปกครอง"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGuardian(g)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบผู้ปกครอง (พร้อมตรวจสอบลบรูปภาพที่ไม่มีใครใช้ออก)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลผู้ปกครองที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationBar({
            currentPage: safeGuardiansPage,
            totalPages: totalGuardiansPages,
            totalCount: totalGuardiansCount,
            startIndex: guardiansStartIndex,
            endIndex: guardiansEndIndex,
            pageSize: guardiansPageSize,
            unitLabel: 'คน',
            onPageChange: setGuardiansPage,
            onPageSizeChange: setGuardiansPageSize,
          })}
        </div>
      )}

      {/* Add / Edit Guardian Modal */}
      {isGuardianModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                {guardianForm.id ? 'แก้ไขข้อมูลผู้ปกครอง (Edit Guardian)' : 'เพิ่มข้อมูลผู้ปกครอง (Guardian Profile)'}
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
                    maxLength={120}
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
                    maxLength={120}
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
                    {GUARDIAN_RELATION_ORDER.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                    {!(GUARDIAN_RELATION_ORDER as readonly string[]).includes(guardianForm.relation) &&
                      guardianForm.relation && (
                        <option value={guardianForm.relation}>{guardianForm.relation}</option>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    maxLength={40}
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

      {/* Issue / Edit Card Modal - 3-Step Non-Auto-Paired Flow with Full Editability & April Expiry */}
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
                    {editingCardId
                      ? 'แก้ไขข้อมูลบัตรรับส่งนักเรียน (Edit Pickup Card)'
                      : 'ออกบัตรรับส่งนักเรียนใหม่ (Pair Student & Guardian)'}
                  </h3>
                  <p className="text-xs text-slate-500 font-sarabun">
                    ทำตามขั้นตอน 1 → 2 → 3 และสามารถย้อนกลับไปเลือกหรือแก้ไขข้อมูลได้ตลอดเวลา
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCardModalOpen(false);
                  setEditingCardId(null);
                }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-2 rounded-xl transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const selectedStudent = students.find((s) => s.studentId === cardForm.studentId);
              const selectedGuardian = guardians.find((g) => g.id === cardForm.guardianId);

              // Filtered students for quick search
              const filteredStudentsForPair = students.filter((s) => {
                const q = studentSearchQuery.toLowerCase().trim();
                if (!q) return true;
                return (
                  s.studentId.toLowerCase().includes(q) ||
                  s.firstName.toLowerCase().includes(q) ||
                  s.lastName.toLowerCase().includes(q) ||
                  (s.nickname && s.nickname.toLowerCase().includes(q)) ||
                  s.classroom.toLowerCase().includes(q) ||
                  formatStudentGradeRoom(s, currentAcademicYear).toLowerCase().includes(q) ||
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
                  g.phone.toLowerCase().includes(q) ||
                  (g.photoFileName && g.photoFileName.toLowerCase().includes(q))
                );
              });

              const existingStudentCards = selectedStudent
                ? cards.filter((c) => c.studentId === selectedStudent.studentId)
                : [];

              const existingGuardianCards = selectedGuardian
                ? cards.filter((c) => c.guardianId === selectedGuardian.id)
                : [];

              const existingPairCard = cards.find(
                (c) =>
                  c.id !== editingCardId &&
                  c.studentId === cardForm.studentId &&
                  c.guardianId === cardForm.guardianId
              );
              const isAlreadyPaired = Boolean(existingPairCard);

              const selectedDesignId = cardForm.frontDesignId || '';
              const previewDesign = selectedDesignId
                ? frontDesigns.find((d) => d.id === selectedDesignId) || null
                : null;

              const virtualCard: PickupCard = {
                id: editingCardId || `card_${cardForm.studentId || '00000'}_temp`,
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

              const handleSelectStudent = (s: Student) => {
                setCardForm((prev) => ({
                  ...prev,
                  studentId: s.studentId,
                  expiryDate: editingCardId
                    ? prev.expiryDate
                    : calculateCardExpiryDate(s.entryYear),
                }));
              };

              const handleSelectGuardian = (g: Guardian) => {
                setCardForm((prev) => ({
                  ...prev,
                  guardianId: g.id,
                }));
              };

              const isStep1Complete = Boolean(
                previewDesign &&
                  cardForm.issueDate.trim() &&
                  cardForm.expiryDate.trim() &&
                  cardForm.expiryDate >= cardForm.issueDate
              );
              const missingFields: Array<{ label: string; step: 1 | 2 | 3 }> = [];
              if (!previewDesign) {
                missingFields.push({ label: 'แม่แบบหน้าบัตรสำหรับพิมพ์ (ขั้นที่ 1)', step: 1 });
              }
              if (!cardForm.issueDate.trim() || !cardForm.expiryDate.trim()) {
                missingFields.push({ label: 'วันที่ออกบัตรและวันหมดอายุ (ขั้นที่ 1)', step: 1 });
              } else if (cardForm.expiryDate < cardForm.issueDate) {
                missingFields.push({ label: 'วันหมดอายุต้องไม่น้อยกว่าวันที่ออกบัตร (ขั้นที่ 1)', step: 1 });
              }
              if (!selectedGuardian) {
                missingFields.push({ label: 'ข้อมูลผู้ปกครอง (ขั้นที่ 2)', step: 2 });
              }
              if (!selectedStudent) {
                missingFields.push({ label: 'ข้อมูลนักเรียน (ขั้นที่ 3)', step: 3 });
              }

              return (
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                  {/* Clickable 3-Step Navigation Bar: 1. Template -> 2. Guardian -> 3. Student */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPairStep(1)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        pairStep === 1
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : isStep1Complete
                          ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          pairStep === 1
                            ? 'bg-white text-blue-600'
                            : isStep1Complete
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isStep1Complete && pairStep !== 1 ? <Check className="w-4 h-4" /> : '1'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">1. เลือกแม่แบบ / วันที่ออกบัตร</div>
                        <div
                          className={`text-[11px] truncate font-sarabun ${
                            pairStep === 1 ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {previewDesign
                            ? previewDesign.name || previewDesign.title
                            : 'ยังไม่ได้เลือกแม่แบบ'}{' '}
                          • หมดอายุ {formatThaiDateShort(cardForm.expiryDate)}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPairStep(2)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        pairStep === 2
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : selectedGuardian
                          ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          pairStep === 2
                            ? 'bg-white text-blue-600'
                            : selectedGuardian
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selectedGuardian && pairStep !== 2 ? <Check className="w-4 h-4" /> : '2'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">2. เลือกข้อมูลผู้ปกครอง</div>
                        <div
                          className={`text-[11px] truncate font-sarabun ${
                            pairStep === 2 ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {selectedGuardian
                            ? `${selectedGuardian.prefix}${selectedGuardian.firstName} (${selectedGuardian.relation})`
                            : 'ยังไม่ได้เลือกผู้ปกครอง'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPairStep(3)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        pairStep === 3
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : selectedStudent
                          ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          pairStep === 3
                            ? 'bg-white text-blue-600'
                            : selectedStudent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selectedStudent && pairStep !== 3 ? <Check className="w-4 h-4" /> : '3'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">3. เลือกข้อมูลนักเรียน</div>
                        <div
                          className={`text-[11px] truncate font-sarabun ${
                            pairStep === 3 ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {selectedStudent
                            ? `${selectedStudent.studentId} • ${selectedStudent.firstName} ${selectedStudent.lastName}`
                            : 'ยังไม่ได้เลือกนักเรียน'}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Active Step Content */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* STEP 1: SELECT TEMPLATE + ISSUE & EXPIRY DATES */}
                      {pairStep === 1 && (
                        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 shadow-xs space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-blue-600" />
                              <span>ขั้นตอนที่ 1: เลือกแม่แบบหน้าบัตร และกำหนดวันที่ออกบัตร</span>
                              <span className="text-red-500">*</span>
                            </div>
                          </div>

                          {/* Template Selection for Printing */}
                          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <label
                                htmlFor="pair-card-template-select"
                                className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
                              >
                                <Layers className="w-4 h-4 text-blue-600" />
                                <span>เลือกแม่แบบหน้าบัตรสำหรับพิมพ์</span>
                                <span className="text-red-500">*</span>
                              </label>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                  previewDesign
                                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                                    : 'text-rose-600 bg-rose-50 border-rose-200'
                                }`}
                              >
                                {previewDesign
                                  ? previewDesign.name || previewDesign.title
                                  : 'ยังไม่ได้เลือกแม่แบบ'}
                              </span>
                            </div>

                            <select
                              id="pair-card-template-select"
                              value={selectedDesignId}
                              onChange={(e) =>
                                setCardForm((prev) => ({
                                  ...prev,
                                  frontDesignId: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun cursor-pointer"
                            >
                              <option value="">เลือกแม่แบบ</option>
                              {frontDesigns.map((d) => (
                                <option key={d.id} value={d.id}>
                                  [{d.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'}] {d.name || d.title}
                                  {d.isDefault ? ' ★ ค่าเริ่มต้น' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Issue & Expiry Dates */}
                          <div className="space-y-3 pt-1 border-t border-slate-100">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span>วันที่ออกบัตรและวันหมดอายุ</span>
                                <span className="text-red-500">*</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setCardForm((prev) => ({
                                    ...prev,
                                    expiryDate: calculateCardExpiryDate(
                                      selectedStudent?.entryYear || currentAcademicYear
                                    ),
                                  }))
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer"
                              >
                                ตั้งหมดอายุ 30 เมษายน (3 ปีการศึกษา)
                              </button>
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
                                  label="วันหมดอายุ (ค่าเริ่มต้นเดือนเมษายน)"
                                  value={cardForm.expiryDate}
                                  onChange={(val) => setCardForm({ ...cardForm, expiryDate: val })}
                                  quickPreset3YearsEntryYear={
                                    selectedStudent?.entryYear || currentAcademicYear
                                  }
                                />
                              </div>
                            </div>

                            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900">
                              <div className="font-semibold flex items-center gap-1.5 mb-0.5 text-blue-950">
                                <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                กฎอายุบัตร 3 ปีการศึกษา (สิ้นเดือนเมษายน):
                              </div>
                              <div className="text-[11px] text-blue-800 font-sarabun leading-relaxed">
                                ระดับ ม.ต้น (ม.1 - ม.3) หรือ ม.ปลาย (ม.4 - ม.6) ตั้งวันหมดอายุเป็นเดือน เมษายน (30 เมษายน) และสามารถปรับแก้ไขวันที่ได้ตามต้องการ
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setPairStep(2)}
                              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>ถัดไป: 2. เลือกข้อมูลผู้ปกครอง</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 2: SELECT GUARDIAN */}
                      {pairStep === 2 && (
                        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-blue-600" />
                              <span>ขั้นตอนที่ 2: เลือกข้อมูลผู้ปกครอง (Select Guardian)</span>
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                พบ {filteredGuardiansForPair.length} / {guardians.length} คน
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
                                className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                เพิ่มผู้ปกครองใหม่
                              </button>
                            </div>
                          </div>

                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="พิมพ์ค้นหาผู้ปกครองด้วยชื่อ, นามสกุล, ความสัมพันธ์, เบอร์โทร..."
                              value={guardianSearchQuery}
                              onChange={(e) => setGuardianSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                            />
                            {guardianSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setGuardianSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Clickable Guardian List */}
                          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/40">
                            {filteredGuardiansForPair.length > 0 ? (
                              filteredGuardiansForPair.map((g) => {
                                const isSelected = cardForm.guardianId === g.id;
                                return (
                                  <div
                                    key={g.id}
                                    onClick={() => handleSelectGuardian(g)}
                                    className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                        : 'bg-white hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <img
                                        src={storageService.resolveImageSrc(g.photoUrl, g.photoAssetId)}
                                        alt={g.firstName}
                                        className="w-10 h-12 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-800 truncate font-sarabun">
                                          {g.prefix}
                                          {g.firstName} {g.lastName}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-sarabun">
                                          <span className="text-blue-700 font-semibold">{g.relation}</span>
                                          {g.phone && <span className="font-mono">• {g.phone}</span>}
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected ? (
                                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                        <Check className="w-3 h-3" />
                                        เลือกแล้ว
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-blue-600 font-semibold shrink-0">
                                        คลิกเพื่อเลือก
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-400">
                                ไม่พบข้อมูลผู้ปกครองที่ค้นหา
                              </div>
                            )}
                          </div>

                          {/* Selected Guardian Info & Edit Option */}
                          {selectedGuardian ? (
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={storageService.resolveImageSrc(
                                      selectedGuardian.photoUrl,
                                      selectedGuardian.photoAssetId
                                    )}
                                    alt={selectedGuardian.firstName}
                                    className="w-14 h-16 object-cover rounded-xl border border-slate-300 bg-white shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-[11px] text-slate-500 font-semibold">
                                      ผู้ปกครองที่เลือก:
                                    </div>
                                    <div className="text-sm font-bold text-slate-800 truncate">
                                      {selectedGuardian.prefix}
                                      {selectedGuardian.firstName} {selectedGuardian.lastName}
                                    </div>
                                    <div className="text-[11px] text-blue-700 font-semibold">
                                      {selectedGuardian.relation}
                                      {selectedGuardian.phone && ` • โทร ${selectedGuardian.phone}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditGuardian(selectedGuardian)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    แก้ไขข้อมูลผู้ปกครอง
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCardForm((prev) => ({ ...prev, guardianId: '' }))
                                    }
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                                  >
                                    ยกเลิกการเลือก
                                  </button>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] gap-1.5">
                                <span className="text-slate-500">
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
                                  <span className="text-slate-400">ยังไม่มีบัตรกับนักเรียนคนอื่น</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                              กรุณาคลิกเลือกรายชื่อผู้ปกครองจากรายการด้านบน (ระบบจะไม่จับคู่ให้อัตโนมัติ)
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => setPairStep(1)}
                              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>ย้อนกลับ: แม่แบบ / วันที่</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPairStep(3)}
                              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>ถัดไป: 3. เลือกข้อมูลนักเรียน</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 3: SELECT STUDENT + SUMMARY */}
                      {pairStep === 3 && (
                        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-blue-600" />
                              <span>ขั้นตอนที่ 3: เลือกข้อมูลนักเรียน (Select Student)</span>
                              <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                              พบ {filteredStudentsForPair.length} / {students.length} คน
                            </span>
                          </div>

                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="พิมพ์ค้นหานักเรียนด้วยรหัส 5 หลัก, ชื่อ, นามสกุล, ชื่อเล่น หรือห้อง..."
                              value={studentSearchQuery}
                              onChange={(e) => setStudentSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                            />
                            {studentSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setStudentSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Clickable Student List */}
                          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/40">
                            {filteredStudentsForPair.length > 0 ? (
                              filteredStudentsForPair.map((s) => {
                                const isSelected = cardForm.studentId === s.studentId;
                                return (
                                  <div
                                    key={s.studentId}
                                    onClick={() => handleSelectStudent(s)}
                                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                        : 'bg-white hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-xs shrink-0">
                                        {s.studentId}
                                      </span>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-800 truncate font-sarabun">
                                          {s.prefix}
                                          {s.firstName} {s.lastName}
                                          {s.nickname && (
                                            <span className="text-slate-500 font-normal ml-1">
                                              ({s.nickname})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-sarabun">
                                          {formatStudentGradeRoom(s, currentAcademicYear)} ({s.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'})
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected ? (
                                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                        <Check className="w-3 h-3" />
                                        เลือกแล้ว
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-blue-600 font-semibold shrink-0">
                                        คลิกเพื่อเลือก
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-400">
                                ไม่พบข้อมูลนักเรียนที่ค้นหา
                              </div>
                            )}
                          </div>

                          {/* Selected Student Info & Edit Option */}
                          {selectedStudent ? (
                            <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-xl border border-blue-200 space-y-2.5">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <div className="text-[11px] text-blue-600 font-semibold">
                                    นักเรียนที่เลือก:
                                  </div>
                                  <div className="text-sm font-bold text-slate-800">
                                    {selectedStudent.prefix}
                                    {selectedStudent.firstName} {selectedStudent.lastName}{' '}
                                    {selectedStudent.nickname && `(${selectedStudent.nickname})`}
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-sarabun mt-0.5">
                                    รหัส {selectedStudent.studentId} • {formatStudentGradeRoom(selectedStudent, currentAcademicYear)} ({selectedStudent.level}) • เข้าศึกษา พ.ศ. {selectedStudent.entryYear}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditStudent(selectedStudent)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    แก้ไขข้อมูลนักเรียน
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCardForm((prev) => ({ ...prev, studentId: '' }))
                                    }
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                                  >
                                    ยกเลิกการเลือก
                                  </button>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-blue-200/70 flex flex-wrap items-center justify-between text-[11px] gap-1.5">
                                <span className="text-slate-500">
                                  บัตรรับส่งที่ผูกไว้แล้ว ({existingStudentCards.length} ใบ):
                                </span>
                                {existingStudentCards.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {existingStudentCards.map((c) => {
                                      const g = guardians.find((x) => x.id === c.guardianId);
                                      return (
                                        <span
                                          key={c.id}
                                          className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded font-sarabun"
                                        >
                                          {g ? `${g.prefix}${g.firstName} (${g.relation})` : c.guardianId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-emerald-700 font-medium">
                                    ยังไม่มีบัตรในระบบ
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                              กรุณาคลิกเลือกรายชื่อนักเรียนจากรายการด้านบน (ระบบจะไม่จับคู่ให้อัตโนมัติ)
                            </div>
                          )}

                          {/* Quick Summary of Step 1 & Step 2 with Go Back buttons */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500">
                                  แม่แบบและวันที่บัตร
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPairStep(1)}
                                  className="text-[11px] text-slate-700 hover:text-blue-600 font-semibold underline cursor-pointer"
                                >
                                  เปลี่ยนแม่แบบ / วันที่
                                </button>
                              </div>
                              {previewDesign ? (
                                <div className="text-xs font-sarabun text-slate-800">
                                  <div className="font-bold truncate">
                                    {previewDesign.name || previewDesign.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    ออกบัตร {formatThaiDateShort(cardForm.issueDate)} • หมดอายุ{' '}
                                    {formatThaiDateShort(cardForm.expiryDate)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-rose-600 font-semibold">
                                  ยังไม่ได้เลือกแม่แบบหน้าบัตร
                                </div>
                              )}
                            </div>

                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500">
                                  ข้อมูลผู้ปกครองที่เลือก
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {selectedGuardian && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditGuardian(selectedGuardian)}
                                      className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                                    >
                                      แก้ไขข้อมูล
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setPairStep(2)}
                                    className="text-[11px] text-slate-700 hover:text-blue-600 font-semibold underline cursor-pointer"
                                  >
                                    เปลี่ยนผู้ปกครอง
                                  </button>
                                </div>
                              </div>
                              {selectedGuardian ? (
                                <div className="text-xs font-sarabun text-slate-800">
                                  <div className="font-bold">
                                    {selectedGuardian.prefix}
                                    {selectedGuardian.firstName} {selectedGuardian.lastName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {selectedGuardian.relation}
                                    {selectedGuardian.phone ? ` • ${selectedGuardian.phone}` : ''}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-rose-600 font-semibold">
                                  ยังไม่ได้เลือกผู้ปกครอง
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => setPairStep(2)}
                              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>ย้อนกลับ: ข้อมูลผู้ปกครอง</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Live Card Preview & Complete Validation Notice */}
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
                          {!previewDesign ? (
                            <div className="w-[372px] max-w-full aspect-[85.6/54] bg-white border border-dashed border-slate-300 rounded-[10px] shadow-xs flex flex-col items-center justify-center text-slate-400 text-xs px-6 text-center gap-1.5">
                              <CreditCard className="w-6 h-6 text-slate-300" />
                              <span className="font-semibold text-slate-500">พื้นหลังว่างเปล่า</span>
                              <span className="text-[11px] text-slate-400 font-sarabun">
                                กรุณาเลือกแม่แบบหน้าบัตรสำหรับพิมพ์ (ขั้นที่ 1) เพื่อแสดงตัวอย่างบัตร
                              </span>
                            </div>
                          ) : (
                            <CardPreview
                              design={previewDesign}
                              student={selectedStudent}
                              guardian={selectedGuardian}
                              card={virtualCard}
                              scale={1.15}
                            />
                          )}
                        </div>

                        <div className="w-full mt-3 pt-2.5 border-t border-slate-200 text-center">
                          <span className="text-[11px] text-slate-500 font-sarabun">
                            แบบบัตรที่แสดง:{' '}
                            <strong>
                              {previewDesign
                                ? previewDesign.name || previewDesign.title
                                : 'ยังไม่ได้เลือกแม่แบบ (พื้นหลังว่างเปล่า)'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Complete Form / Duplicate Validation Status Card */}
                      {missingFields.length > 0 ? (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 space-y-2">
                          <div className="font-bold text-xs flex items-center gap-1.5 text-slate-700">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            กรุณากรอกข้อมูลให้ครบก่อนบันทึก ({missingFields.length} รายการ)
                          </div>
                          <ul className="space-y-1 text-[11px] text-slate-600 font-sarabun">
                            {missingFields.map((item) => (
                              <li key={item.label} className="flex items-center justify-between gap-2">
                                <span>• ยังไม่ได้ระบุ: {item.label}</span>
                                <button
                                  type="button"
                                  onClick={() => setPairStep(item.step)}
                                  className="text-blue-600 hover:underline font-semibold shrink-0 cursor-pointer"
                                >
                                  ไปขั้นที่ {item.step}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : isAlreadyPaired ? (
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
                                  onSendCardToPrintTray(
                                    existingPairCard.id,
                                    cardForm.frontDesignId || existingPairCard.frontDesignId || undefined
                                  );
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
                            {editingCardId
                              ? 'ข้อมูลครบถ้วน พร้อมบันทึกการแก้ไขบัตร'
                              : 'ข้อมูลครบถ้วน พร้อมออกบัตรรับส่งใหม่'}
                          </div>
                          <p className="text-[11px] text-emerald-800 font-sarabun">
                            สามารถกดแท็บขั้นตอนด้านบนเพื่อย้อนกลับไปแก้ไขแม่แบบ วันที่ ผู้ปกครอง หรือนักเรียนได้ตลอดเวลา
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
              const selectedDesign = cardForm.frontDesignId
                ? frontDesigns.find((d) => d.id === cardForm.frontDesignId)
                : undefined;
              const hasValidDates = Boolean(
                cardForm.issueDate.trim() &&
                  cardForm.expiryDate.trim() &&
                  cardForm.expiryDate >= cardForm.issueDate
              );
              const isAlreadyPaired = cards.some(
                (c) =>
                  c.id !== editingCardId &&
                  c.studentId === cardForm.studentId &&
                  c.guardianId === cardForm.guardianId
              );
              const canSubmit = Boolean(
                selectedDesign &&
                  hasValidDates &&
                  selectedGuardian &&
                  selectedStudent &&
                  !isAlreadyPaired
              );

              const missingLabels: string[] = [];
              if (!selectedDesign) missingLabels.push('แม่แบบ');
              if (!hasValidDates) missingLabels.push('วันที่');
              if (!selectedGuardian) missingLabels.push('ผู้ปกครอง');
              if (!selectedStudent) missingLabels.push('นักเรียน');

              return (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-sarabun text-center sm:text-left">
                    {canSubmit && selectedStudent && selectedGuardian && selectedDesign ? (
                      <span>
                        ครบถ้วน: <strong className="text-slate-800">{selectedDesign.name || selectedDesign.title}</strong> • <strong className="text-blue-700">{selectedGuardian.prefix}{selectedGuardian.firstName}</strong> ↔ <strong className="text-slate-800">รหัส {selectedStudent.studentId} ({selectedStudent.firstName})</strong>
                      </span>
                    ) : isAlreadyPaired ? (
                      <span className="text-amber-700 font-semibold">
                        ไม่สามารถบันทึกได้ เนื่องจากนักเรียนและผู้ปกครองคู่นี้มีบัตรในระบบแล้ว
                      </span>
                    ) : (
                      <span>
                        ข้อมูลยังไม่ครบ ({missingLabels.join(', ')}) — กรุณาเลือกให้ครบทุกขั้นตอนก่อนบันทึก
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCardModalOpen(false);
                        setEditingCardId(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>

                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => handleIssueCard(undefined, false)}
                      className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                        canSubmit
                          ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {editingCardId ? 'บันทึกการแก้ไขบัตร' : 'บันทึกออกบัตรรับส่ง'}
                    </button>

                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => handleIssueCard(undefined, true)}
                      className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                        canSubmit
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      title="บันทึกบัตรและเปิดหน้าถาดพิมพ์ทันที"
                    >
                      <Printer className="w-4 h-4" />
                      {editingCardId ? 'บันทึกและส่งพิมพ์ลงถาด' : 'ออกบัตรและส่งพิมพ์ลงถาดทันที'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Quick Edit Student Modal (opened from Pair Student & Guardian) */}
      {isStudentEditModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                แก้ไขข้อมูลนักเรียน (รหัส {studentEditForm.studentId})
              </h3>
              <button
                type="button"
                onClick={() => setIsStudentEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">คำนำหน้า</label>
                  <select
                    value={studentEditForm.prefix}
                    onChange={(e) => setStudentEditForm({ ...studentEditForm, prefix: e.target.value })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                    <option value="นาย">นาย</option>
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
                    maxLength={120}
                    value={studentEditForm.firstName}
                    onChange={(e) => setStudentEditForm({ ...studentEditForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-sarabun"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={studentEditForm.lastName}
                    onChange={(e) => setStudentEditForm({ ...studentEditForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-sarabun"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อเล่น</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={studentEditForm.nickname}
                    onChange={(e) => setStudentEditForm({ ...studentEditForm, nickname: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-sarabun"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ช่วงชั้น</label>
                  <select
                    value={studentEditForm.level}
                    onChange={(e) =>
                      setStudentEditForm({
                        ...studentEditForm,
                        level: e.target.value as EducationLevel,
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น</option>
                    <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ห้องเรียน</label>
                  <input
                    type="text"
                    maxLength={30}
                    value={studentEditForm.classroom}
                    onChange={(e) => setStudentEditForm({ ...studentEditForm, classroom: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-sarabun"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ปี พ.ศ. เข้าศึกษา</label>
                  <input
                    type="number"
                    min={2550}
                    max={2590}
                    value={studentEditForm.entryYear}
                    onChange={(e) =>
                      setStudentEditForm({
                        ...studentEditForm,
                        entryYear: parseInt(e.target.value, 10) || getCurrentBuddhistYear(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-sarabun"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStudentEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูลนักเรียน
                </button>
              </div>
            </form>
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
