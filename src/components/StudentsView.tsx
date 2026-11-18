import React, { useState, useEffect, useMemo } from 'react';
import { Student, EducationLevel, PickupCard, Guardian } from '../types';
import { storageService } from '../utils/storage';
import {
  calculateCurrentGrade,
  getCurrentBuddhistYear,
  formatThaiDateShort,
} from '../utils/thaiDate';
import {
  Users,
  UserPlus,
  Upload,
  FileSpreadsheet,
  GraduationCap,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  CreditCard,
  Phone,
  QrCode,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
} from 'lucide-react';

interface StudentsViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToCardsForStudent?: (studentId: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onNotify,
  onNavigateToCardsForStudent,
}) => {
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear()
  );
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());

  useEffect(() => {
    return storageService.subscribe(() => {
      setCurrentAcademicYear(storageService.getAcademicYear());
      setStudents(storageService.getStudents());
      setCards(storageService.getCards());
      setGuardians(storageService.getGuardians());
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classroomFilter, setClassroomFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Add/Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<{
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
    entryYear: currentAcademicYear,
  });

  // CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [csvText, setCsvText] = useState<string>('');
  const [csvParsePreview, setCsvParsePreview] = useState<Student[]>([]);

  // Graduation Cleanup Modal
  const [isGraduationModalOpen, setIsGraduationModalOpen] = useState<boolean>(false);
  const [gradTargetLevel, setGradTargetLevel] = useState<'all' | EducationLevel>('all');
  const [gradEntryYear, setGradEntryYear] = useState<number>(currentAcademicYear - 2); // 3 years studied (2569 - 2 = 2567)
  const [gradSearchQuery, setGradSearchQuery] = useState<string>('');
  const [gradShowAllStudents, setGradShowAllStudents] = useState<boolean>(false);
  const [selectedGradStudentIds, setSelectedGradStudentIds] = useState<string[]>([]);
  const [isConfirmingGradDelete, setIsConfirmingGradDelete] = useState<boolean>(false);
  const [isExecutingGraduation, setIsExecutingGraduation] = useState<boolean>(false);

  // Compute available grade levels & counts based on current levelFilter
  const gradeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let hasGraduated = false;

    students.forEach((s) => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return;
      const gradeInfo = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
      const key = gradeInfo.isGraduated ? 'graduated' : gradeInfo.gradeLabel;
      if (gradeInfo.isGraduated) hasGraduated = true;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const baseGrades =
      levelFilter === 'มัธยมศึกษาตอนต้น'
        ? ['ม.1', 'ม.2', 'ม.3']
        : levelFilter === 'มัธยมศึกษาตอนปลาย'
        ? ['ม.4', 'ม.5', 'ม.6']
        : ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

    const options = baseGrades.map((g) => ({
      value: g,
      label: g,
      count: counts.get(g) || 0,
    }));

    if (hasGraduated) {
      options.push({
        value: 'graduated',
        label: 'จบการศึกษาแล้ว',
        count: counts.get('graduated') || 0,
      });
    }

    return options;
  }, [students, levelFilter, currentAcademicYear]);

  // Compute available classrooms & counts based on levelFilter + gradeFilter
  const classroomOptions = useMemo(() => {
    const counts = new Map<string, number>();

    students.forEach((s) => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return;
      const gradeInfo = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
      const gradeKey = gradeInfo.isGraduated ? 'graduated' : gradeInfo.gradeLabel;
      if (gradeFilter !== 'all' && gradeKey !== gradeFilter) return;

      const room = s.classroom.trim();
      if (!room) return;
      counts.set(room, (counts.get(room) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' }))
      .map(([room, count]) => ({
        value: room,
        label: `ห้อง ${room}`,
        count,
      }));
  }, [students, levelFilter, gradeFilter, currentAcademicYear]);

  // Keep gradeFilter & classroomFilter valid when parent filters change
  useEffect(() => {
    if (gradeFilter !== 'all' && !gradeOptions.some((opt) => opt.value === gradeFilter)) {
      setGradeFilter('all');
    }
  }, [gradeFilter, gradeOptions]);

  useEffect(() => {
    if (classroomFilter !== 'all' && !classroomOptions.some((opt) => opt.value === classroomFilter)) {
      setClassroomFilter('all');
    }
  }, [classroomFilter, classroomOptions]);

  // Filter students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const matchesLevel = levelFilter === 'all' || s.level === levelFilter;
      if (!matchesLevel) return false;

      const gradeInfo = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
      const gradeKey = gradeInfo.isGraduated ? 'graduated' : gradeInfo.gradeLabel;
      const matchesGrade = gradeFilter === 'all' || gradeKey === gradeFilter;
      if (!matchesGrade) return false;

      const matchesClassroom =
        classroomFilter === 'all' || s.classroom.trim() === classroomFilter;
      if (!matchesClassroom) return false;

      if (!q) return true;
      return (
        s.studentId.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.nickname.toLowerCase().includes(q) ||
        s.classroom.toLowerCase().includes(q) ||
        gradeInfo.gradeLabel.toLowerCase().includes(q)
      );
    });
  }, [students, levelFilter, gradeFilter, classroomFilter, searchQuery, currentAcademicYear]);

  // Reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, levelFilter, gradeFilter, classroomFilter, pageSize]);

  // Pagination calculations
  const totalFilteredCount = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
  const paginatedStudents = useMemo(
    () => filteredStudents.slice(startIndex, endIndex),
    [filteredStudents, startIndex, endIndex]
  );

  const paginationItems = useMemo<(number | 'ellipsis-left' | 'ellipsis-right')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, 'ellipsis-right', totalPages];
    }
    if (safeCurrentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [
      1,
      'ellipsis-left',
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      'ellipsis-right',
      totalPages,
    ];
  }, [totalPages, safeCurrentPage]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    levelFilter !== 'all' ||
    gradeFilter !== 'all' ||
    classroomFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setLevelFilter('all');
    setGradeFilter('all');
    setClassroomFilter('all');
    setCurrentPage(1);
  };

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      studentId: '',
      prefix: 'เด็กชาย',
      firstName: '',
      lastName: '',
      nickname: '',
      level: 'มัธยมศึกษาตอนต้น',
      classroom: '1',
      entryYear: currentAcademicYear,
    });
    setIsFormModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      studentId: student.studentId,
      prefix: student.prefix,
      firstName: student.firstName,
      lastName: student.lastName,
      nickname: student.nickname,
      level: student.level,
      classroom: student.classroom,
      entryYear: student.entryYear,
    });
    setIsFormModalOpen(true);
  };

  // Save student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate 5-digit ID
    const cleanId = formData.studentId.trim();
    if (!/^\d{5}$/.test(cleanId)) {
      onNotify('รหัสนักเรียนต้องเป็นตัวเลข 5 หลักเท่านั้น (เช่น 00001)', 'error');
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      onNotify('กรุณาระบุชื่อและนามสกุลนักเรียน', 'error');
      return;
    }

    // Check duplicate ID if new
    if (!editingStudent && students.some((s) => s.studentId === cleanId)) {
      onNotify(`มีรหัสนักเรียน ${cleanId} ในระบบแล้ว`, 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedList: Student[];

    if (editingStudent) {
      updatedList = students.map((s) =>
        s.studentId === editingStudent.studentId
          ? {
              ...s,
              prefix: formData.prefix,
              firstName: formData.firstName.trim(),
              lastName: formData.lastName.trim(),
              nickname: formData.nickname.trim(),
              level: formData.level,
              classroom: formData.classroom.trim(),
              entryYear: Number(formData.entryYear),
              updatedAt: nowIso,
            }
          : s
      );
      onNotify(`อัปเดตข้อมูลนักเรียน ${cleanId} เรียบร้อยแล้ว`, 'success');
    } else {
      const newStudent: Student = {
        studentId: cleanId,
        prefix: formData.prefix,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        nickname: formData.nickname.trim(),
        level: formData.level,
        classroom: formData.classroom.trim(),
        entryYear: Number(formData.entryYear),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedList = [newStudent, ...students];
      onNotify(`เพิ่มนักเรียนรหัส ${cleanId} เข้าสู่ระบบสำเร็จ`, 'success');
    }

    setStudents(updatedList);
    storageService.saveStudents(updatedList);
    setIsFormModalOpen(false);
  };

  // Delete student
  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (confirm(`คุณต้องการลบข้อมูลนักเรียน "${name}" (รหัส ${studentId}) พร้อมบัตรรับส่งที่ผูกอยู่ใช่หรือไม่?`)) {
      const res = await storageService.deleteStudent(studentId);
      const remaining = students.filter((s) => s.studentId !== studentId);
      setStudents(remaining);
      onNotify(`ลบข้อมูลนักเรียนและบัตรที่เกี่ยวข้อง (${res.removedCardsCount} ใบ) เรียบร้อยแล้ว`, 'info');
    }
  };

  // CSV Parsing supporting exact headers: รหัสนักเรียน,คำนำหน้า,ชื่อ,นามสกุล,ชื่อเล่น,ระดับชั้น,ห้อง
  const handleParseCsv = (text: string) => {
    setCsvText(text);
    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      setCsvParsePreview([]);
      return;
    }

    const parsed: Student[] = [];

    // Helper to split a line by tab or comma
    const splitLine = (line: string): string[] => {
      const delimiter = line.includes('\t') ? '\t' : ',';
      return line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    };

    // Check if first line is a header
    const firstCols = splitLine(rawLines[0]);
    const hasHeader = firstCols.some(
      (c) =>
        c.includes('รหัส') ||
        c.toLowerCase().includes('id') ||
        c.includes('คำนำหน้า') ||
        c.includes('ชื่อ') ||
        c.includes('ระดับ') ||
        c.includes('ห้อง')
    );

    let idIdx = 0;
    let prefixIdx = 1;
    let firstNameIdx = 2;
    let lastNameIdx = 3;
    let nicknameIdx = 4;
    let levelIdx = 5;
    let roomIdx = 6;
    let yearIdx = 7;

    let startIndex = 0;

    if (hasHeader) {
      startIndex = 1;
      firstCols.forEach((col, idx) => {
        const cleanCol = col.replace(/\s+/g, '');
        if (cleanCol.includes('รหัส') || cleanCol.toLowerCase().includes('id')) {
          idIdx = idx;
        } else if (cleanCol.includes('คำนำหน้า') || cleanCol.toLowerCase().includes('prefix')) {
          prefixIdx = idx;
        } else if (cleanCol.includes('ชื่อเล่น') || cleanCol.toLowerCase().includes('nickname')) {
          nicknameIdx = idx;
        } else if (cleanCol.includes('ชื่อ') && !cleanCol.includes('ชื่อเล่น')) {
          firstNameIdx = idx;
        } else if (cleanCol.includes('นามสกุล') || cleanCol.toLowerCase().includes('lastname')) {
          lastNameIdx = idx;
        } else if (
          cleanCol.includes('ระดับชั้น') ||
          cleanCol.includes('ช่วงชั้น') ||
          cleanCol.includes('ชั้น') ||
          cleanCol.toLowerCase().includes('grade') ||
          cleanCol.toLowerCase().includes('level')
        ) {
          levelIdx = idx;
        } else if (cleanCol.includes('ห้อง') || cleanCol.toLowerCase().includes('room')) {
          roomIdx = idx;
        } else if (cleanCol.includes('ปี') || cleanCol.includes('พ.ศ.')) {
          yearIdx = idx;
        }
      });
    }

    for (let i = startIndex; i < rawLines.length; i++) {
      const cols = splitLine(rawLines[i]);
      if (cols.length >= 3) {
        let rawId = (cols[idIdx] || '').replace(/\D/g, '');
        if (rawId.length > 0 && rawId.length < 5) {
          rawId = rawId.padStart(5, '0');
        }
        const studentId = rawId;

        const prefix = cols[prefixIdx] || 'เด็กชาย';
        const firstName = cols[firstNameIdx] || '';
        const lastName = cols[lastNameIdx] || '';
        const nickname = cols[nicknameIdx] || '';
        const rawLevel = cols[levelIdx] || 'ม.1';
        let classroom = cols[roomIdx] || '1';

        // Normalize level and compute entryYear from currentAcademicYear
        let level: EducationLevel = 'มัธยมศึกษาตอนต้น';
        let entryYear = currentAcademicYear;

        const cleanLevel = rawLevel.replace(/\s+/g, '');

        if (cleanLevel.includes('ม.1') || cleanLevel === '1' || cleanLevel.includes('มัธยมศึกษาปีที่1')) {
          level = 'มัธยมศึกษาตอนต้น';
          entryYear = currentAcademicYear; // Entered this year
        } else if (cleanLevel.includes('ม.2') || cleanLevel === '2' || cleanLevel.includes('มัธยมศึกษาปีที่2')) {
          level = 'มัธยมศึกษาตอนต้น';
          entryYear = currentAcademicYear - 1; // Entered 1 year ago
        } else if (cleanLevel.includes('ม.3') || cleanLevel === '3' || cleanLevel.includes('มัธยมศึกษาปีที่3')) {
          level = 'มัธยมศึกษาตอนต้น';
          entryYear = currentAcademicYear - 2; // Entered 2 years ago
        } else if (cleanLevel.includes('ม.4') || cleanLevel === '4' || cleanLevel.includes('มัธยมศึกษาปีที่4')) {
          level = 'มัธยมศึกษาตอนปลาย';
          entryYear = currentAcademicYear;
        } else if (cleanLevel.includes('ม.5') || cleanLevel === '5' || cleanLevel.includes('มัธยมศึกษาปีที่5')) {
          level = 'มัธยมศึกษาตอนปลาย';
          entryYear = currentAcademicYear - 1;
        } else if (cleanLevel.includes('ม.6') || cleanLevel === '6' || cleanLevel.includes('มัธยมศึกษาปีที่6')) {
          level = 'มัธยมศึกษาตอนปลาย';
          entryYear = currentAcademicYear - 2;
        } else if (cleanLevel.includes('ปลาย')) {
          level = 'มัธยมศึกษาตอนปลาย';
          entryYear = currentAcademicYear;
        } else {
          level = 'มัธยมศึกษาตอนต้น';
          entryYear = currentAcademicYear;
        }

        // If explicit year is given
        if (cols[yearIdx]) {
          const parsedYear = parseInt(cols[yearIdx], 10);
          if (!isNaN(parsedYear) && parsedYear >= 2500) {
            entryYear = parsedYear;
          }
        }

        // If classroom is just a number like "2", and level is "ม.1", format as "1/2" for card display
        if (/^\d+$/.test(classroom)) {
          const gradeNum = level === 'มัธยมศึกษาตอนต้น'
            ? (currentAcademicYear - entryYear + 1)
            : (currentAcademicYear - entryYear + 4);
          classroom = `${gradeNum}/${classroom}`;
        }

        if (/^\d{5}$/.test(studentId) && firstName) {
          parsed.push({
            studentId,
            prefix,
            firstName,
            lastName,
            nickname,
            level,
            classroom,
            entryYear,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    setCsvParsePreview(parsed);
  };

  const handleImportCsv = () => {
    if (csvParsePreview.length === 0) {
      onNotify('ไม่มีข้อมูลนักเรียนที่ถูกต้องสำหรับนำเข้า', 'error');
      return;
    }

    // Upsert or merge
    const existingMap = new Map(students.map((s) => [s.studentId, s]));
    csvParsePreview.forEach((s) => existingMap.set(s.studentId, s));
    const merged = Array.from(existingMap.values());

    setStudents(merged);
    storageService.saveStudents(merged);
    setIsImportModalOpen(false);
    setCsvText('');
    setCsvParsePreview([]);
    onNotify(`นำเข้าข้อมูลนักเรียนจำนวน ${csvParsePreview.length} คน เรียบร้อยแล้ว`, 'success');
  };

  // Download clean 7-column CSV header template (no mock student rows)
  const handleDownloadSampleCsv = () => {
    const csvHeaderTemplate = 'รหัสนักเรียน,คำนำหน้า,ชื่อ,นามสกุล,ชื่อเล่น,ระดับชั้น,ห้อง\n';
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvHeaderTemplate], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student_template_7cols_${currentAcademicYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const guardianMap = useMemo(() => {
    const map = new Map<string, Guardian>();
    guardians.forEach((g) => map.set(g.id, g));
    return map;
  }, [guardians]);

  const cardsByStudentMap = useMemo(() => {
    const map = new Map<string, PickupCard[]>();
    cards.forEach((c) => {
      const list = map.get(c.studentId) || [];
      list.push(c);
      map.set(c.studentId, list);
    });
    return map;
  }, [cards]);

  const matchingGradStudents = useMemo(() => {
    const q = gradSearchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const matchesLevel = gradTargetLevel === 'all' || s.level === gradTargetLevel;
      const matchesYear = gradShowAllStudents || s.entryYear <= gradEntryYear;
      if (!matchesLevel || !matchesYear) return false;
      if (!q) return true;

      const studentCards = cardsByStudentMap.get(s.studentId) || [];
      const matchesGuardian = studentCards.some((card) => {
        const g = guardianMap.get(card.guardianId);
        if (!g) return false;
        const gName = `${g.prefix}${g.firstName} ${g.lastName}`.toLowerCase();
        return (
          gName.includes(q) ||
          g.relation.toLowerCase().includes(q) ||
          g.phone.toLowerCase().includes(q) ||
          card.qrCodeText.toLowerCase().includes(q)
        );
      });

      return (
        s.studentId.includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.nickname.toLowerCase().includes(q) ||
        s.classroom.toLowerCase().includes(q) ||
        matchesGuardian
      );
    });
  }, [
    students,
    gradTargetLevel,
    gradEntryYear,
    gradShowAllStudents,
    gradSearchQuery,
    cardsByStudentMap,
    guardianMap,
  ]);

  const selectedGradIdSet = useMemo(
    () => new Set(selectedGradStudentIds),
    [selectedGradStudentIds]
  );

  const selectedGradCardsCount = useMemo(() => {
    let count = 0;
    selectedGradStudentIds.forEach((studentId) => {
      count += (cardsByStudentMap.get(studentId) || []).length;
    });
    return count;
  }, [selectedGradStudentIds, cardsByStudentMap]);

  const allVisibleGradSelected =
    matchingGradStudents.length > 0 &&
    matchingGradStudents.every((s) => selectedGradIdSet.has(s.studentId));

  const handleOpenGraduationModal = () => {
    setGradTargetLevel('all');
    setGradEntryYear(currentAcademicYear - 2);
    setGradSearchQuery('');
    setGradShowAllStudents(false);
    setSelectedGradStudentIds([]);
    setIsConfirmingGradDelete(false);
    setIsGraduationModalOpen(true);
  };

  const handleToggleGradStudent = (studentId: string) => {
    setIsConfirmingGradDelete(false);
    setSelectedGradStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleToggleSelectAllGradStudents = () => {
    setIsConfirmingGradDelete(false);
    const visibleIds = matchingGradStudents.map((s) => s.studentId);
    if (allVisibleGradSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedGradStudentIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedGradStudentIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Graduation Cleanup Execution
  const handleExecuteGraduation = async () => {
    if (selectedGradStudentIds.length === 0 || isExecutingGraduation) return;
    setIsExecutingGraduation(true);
    try {
      const result = await storageService.cleanupSelectedGraduatedStudents(selectedGradStudentIds);
      setStudents(storageService.getStudents());
      setCards(storageService.getCards());
      setSelectedGradStudentIds([]);
      setIsConfirmingGradDelete(false);
      setIsGraduationModalOpen(false);
      onNotify(
        `ดำเนินการลบข้อมูลที่เลือกสำเร็จ: ลบนักเรียน ${result.studentsCount} คน, บัตรรับส่ง ${result.cardsCount} ใบ, ลบไฟล์รูปถ่ายที่ไม่มีผู้อื่นใช้ออกจาก Storage ${result.orphanedPhotosDeleted} ไฟล์`,
        'success'
      );
    } catch (error) {
      console.error('Failed to execute graduation cleanup:', error);
      onNotify('เกิดข้อผิดพลาดระหว่างการลบข้อมูล กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsExecutingGraduation(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            ข้อมูลนักเรียนและจัดการรายปี (Students Management)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ใช้รหัสนักเรียน 5 หลัก เป็นคีย์หลัก • คำนวณระดับชั้นอัตโนมัติเทียบกับปี พ.ศ. ปัจจุบัน ({currentAcademicYear})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Graduation Cleanup Button */}
          <button
            type="button"
            onClick={handleOpenGraduationModal}
            className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-rose-600" />
            ระบบยกเลิกข้อมูลเมื่อจบการศึกษา
          </button>

          {/* CSV Import Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            นำเข้าไฟล์ CSV/Excel
          </button>

          {/* Add Student Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            เพิ่มนักเรียนใหม่
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาด้วยรหัส 5 หลัก, ชื่อ, นามสกุล หรือห้อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
            <div className="inline-flex items-center gap-2 text-xs bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLevelFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  levelFilter === 'all' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                ทั้งหมด ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter('มัธยมศึกษาตอนต้น')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  levelFilter === 'มัธยมศึกษาตอนต้น'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                ม.ต้น (ม.1-ม.3)
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter('มัธยมศึกษาตอนปลาย')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  levelFilter === 'มัธยมศึกษาตอนปลาย'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                ม.ปลาย (ม.4-ม.6)
              </button>
            </div>
          </div>
        </div>

        {/* Grade & Classroom Filters */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>กรองตามระดับชั้น/ห้อง:</span>
            </div>

            <select
              aria-label="เลือกระดับชั้น"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium font-sarabun cursor-pointer"
            >
              <option value="all">ทุกระดับชั้น</option>
              {gradeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count} คน)
                </option>
              ))}
            </select>

            <select
              aria-label="เลือกห้องเรียน"
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium font-sarabun cursor-pointer"
            >
              <option value="all">ทุกห้อง ({classroomOptions.length} ห้อง)</option>
              {classroomOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count} คน)
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-sarabun">
            <span>
              พบนักเรียน <strong className="text-slate-800">{totalFilteredCount}</strong> คน
              {hasActiveFilters && ` (จากทั้งหมด ${students.length} คน)`}
            </span>
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">รหัส 5 หลัก</th>
                <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                <th className="py-3 px-4">ชื่อเล่น</th>
                <th className="py-3 px-4">ช่วงชั้น</th>
                <th className="py-3 px-4">ห้อง</th>
                <th className="py-3 px-4">ปีที่เข้าศึกษา (พ.ศ.)</th>
                <th className="py-3 px-4">ระดับชั้นคำนวณอัตโนมัติ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sarabun">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((s) => {
                  const gradeInfo = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
                  return (
                    <tr key={s.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {s.studentId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {s.prefix}
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.nickname || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            s.level === 'มัธยมศึกษาตอนต้น'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {s.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        ห้อง {s.classroom}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        พ.ศ. {s.entryYear}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            gradeInfo.isGraduated
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {gradeInfo.isGraduated ? (
                            <>
                              <GraduationCap className="w-3 h-3 text-slate-500" />
                              จบการศึกษาแล้ว
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {gradeInfo.gradeLabel} (ปีที่ {gradeInfo.yearsStudied}/3)
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไขข้อมูลนักเรียน"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteStudent(s.studentId, `${s.prefix}${s.firstName} ${s.lastName}`)
                            }
                            className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบนักเรียน"
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
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalFilteredCount > 0 && (
          <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-sarabun">
              <span>
                แสดง{' '}
                <strong className="text-slate-800">
                  {startIndex + 1}–{endIndex}
                </strong>{' '}
                จาก <strong className="text-slate-800">{totalFilteredCount}</strong> คน (หน้า{' '}
                <strong className="text-slate-800">{safeCurrentPage}</strong> / {totalPages})
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">แสดงหน้าละ</span>
                <select
                  aria-label="จำนวนนักเรียนต่อหน้า"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-500">คน</span>
              </div>
            </div>

            <nav aria-label="ตัวแบ่งหน้าตารางนักเรียน" className="flex items-center gap-1">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="หน้าแรก"
                aria-label="หน้าแรก"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="หน้าก่อนหน้า"
                aria-label="หน้าก่อนหน้า"
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-xs font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">ก่อนหน้า</span>
              </button>

              <div className="flex items-center gap-1 mx-1">
                {paginationItems.map((item) =>
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      aria-label={`หน้า ${item}`}
                      aria-current={item === safeCurrentPage ? 'page' : undefined}
                      className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        item === safeCurrentPage
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
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="หน้าถัดไป"
                aria-label="หน้าถัดไป"
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-xs font-medium"
              >
                <span className="hidden md:inline">ถัดไป</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="หน้าสุดท้าย"
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                {editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4">
              {/* Student ID (5 Digits) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสนักเรียน 5 หลัก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  required
                  disabled={Boolean(editingStudent)}
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value.replace(/\D/g, '') })}
                  placeholder="กรอกตัวเลข 5 หลัก"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  ใช้เป็นคีย์หลัก (Primary Key) ในการผูกข้อมูลบัตรรับส่งและผู้ปกครอง
                </p>
              </div>

              {/* Prefix, First, Last Name */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">คำนำหน้า</label>
                  <select
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="นามสกุล"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
              </div>

              {/* Nickname & Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อเล่น</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="เช่น ก้อง, แพรวา"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ช่วงชั้น</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as EducationLevel })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="มัธยมศึกษาตอนต้น">มัธยมศึกษาตอนต้น (ม.1 - ม.3)</option>
                    <option value="มัธยมศึกษาตอนปลาย">มัธยมศึกษาตอนปลาย (ม.4 - ม.6)</option>
                  </select>
                </div>
              </div>

              {/* Classroom & Entry Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ห้องเรียน</label>
                  <input
                    type="text"
                    value={formData.classroom}
                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                    placeholder="เช่น 1, 2 หรือ 1/2"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ปี พ.ศ. ที่เข้ารับการศึกษา
                  </label>
                  <input
                    type="number"
                    min={2550}
                    max={2590}
                    value={formData.entryYear}
                    onChange={(e) => setFormData({ ...formData, entryYear: parseInt(e.target.value, 10) || currentAcademicYear })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
                  />
                </div>
              </div>

              {/* Preview Calculated Grade */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  การคำนวณระดับชั้นอัตโนมัติในปีการศึกษา {currentAcademicYear}:
                </div>
                <div className="text-[11px] text-blue-700 font-sarabun">
                  {calculateCurrentGrade(formData.level, formData.entryYear, currentAcademicYear).gradeLabel} • อายุบัตรรับส่ง 3 ปีการศึกษา
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  {editingStudent ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลนักเรียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Batch Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  นำเข้าข้อมูลนักเรียนจำนวนมากผ่านไฟล์ CSV / Excel
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  วางข้อความ CSV หรืออัปโหลดไฟล์ที่มีคอลัมน์รหัส 5 หลัก, คำนำหน้า, ชื่อ, นามสกุล ฯลฯ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Format Guide Badge */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-blue-900">
                  <span>โครงสร้าง 7 คอลัมน์ที่รองรับ:</span>
                </div>
                <div className="font-mono text-[11px] text-blue-800 bg-white/80 p-2 rounded-lg border border-blue-200/60 overflow-x-auto">
                  รหัสนักเรียน,คำนำหน้า,ชื่อ,นามสกุล,ชื่อเล่น,ระดับชั้น,ห้อง
                </div>
                <p className="text-[11px] text-blue-700 font-sarabun">
                  * รองรับการคัดลอกจาก Excel หรือ Google Sheets โดยตรง (คั่นด้วย Comma หรือ Tab) และระบบจะคำนวณปีที่เข้าศึกษา (พ.ศ.) ให้อัตโนมัติจากระดับชั้น (ม.1 - ม.6)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  วางข้อความ CSV หรืออัปโหลดไฟล์ (.csv):
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  ดาวน์โหลดไฟล์แม่แบบ CSV (7 คอลัมน์)
                </button>
              </div>

              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => handleParseCsv(e.target.value)}
                placeholder="รหัสนักเรียน,คำนำหน้า,ชื่อ,นามสกุล,ชื่อเล่น,ระดับชั้น,ห้อง&#10;00001,เด็กชาย,ชื่อจริง,นามสกุล,ชื่อเล่น,ม.1,1/1"
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>เลือกไฟล์ CSV จากเครื่อง</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        handleParseCsv(reader.result as string);
                      };
                      reader.readAsText(file, 'utf-8');
                    }}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">
                  ตรวจพบข้อมูลที่ถูกต้อง: <strong>{csvParsePreview.length}</strong> คน
                </span>
              </div>

              {/* Preview parsed rows */}
              {csvParsePreview.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[11px] text-slate-700 font-sarabun">
                    <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">รหัส</th>
                        <th className="p-2">ชื่อ - นามสกุล</th>
                        <th className="p-2">ช่วงชั้น</th>
                        <th className="p-2">ห้อง</th>
                        <th className="p-2">ปีเข้า (พ.ศ.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvParsePreview.slice(0, 10).map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-bold text-blue-600">{p.studentId}</td>
                          <td className="p-2">
                            {p.prefix}
                            {p.firstName} {p.lastName}
                          </td>
                          <td className="p-2">{p.level}</td>
                          <td className="p-2">{p.classroom}</td>
                          <td className="p-2">{p.entryYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvParsePreview.length > 10 && (
                    <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                      และอีก {csvParsePreview.length - 10} รายการ...
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={csvParsePreview.length === 0}
                  onClick={handleImportCsv}
                  className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs ${
                    csvParsePreview.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  นำเข้า {csvParsePreview.length} รายการ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graduation Cleanup Modal */}
      {isGraduationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-rose-950 text-sm flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-rose-600" />
                  ระบบยกเลิกข้อมูลเมื่อจบการศึกษาประจำปี
                </h3>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  แสดงรายชื่อนักเรียนพร้อมบัตรรับส่งของผู้ปกครองที่ผูกอยู่ และเลือกรายชื่อที่ต้องการลบออกจากระบบ
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingGradDelete(false);
                  setIsGraduationModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filters & Selection Controls */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-3 shrink-0">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  เลือกรายชื่อนักเรียนที่ต้องการลบออกจากระบบ ระบบจะลบบัตรรับส่งของผู้ปกครองที่ผูกอยู่กับนักเรียนที่เลือก และ{' '}
                  <strong>ตรวจสอบลบไฟล์รูปถ่ายที่ไม่มีการอ้างอิงถึงอีก</strong> ออกจาก Firebase Storage อัตโนมัติ
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                {/* Target Level */}
                <div className="lg:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ช่วงชั้นที่ต้องการแสดง
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setGradTargetLevel('all');
                        setIsConfirmingGradDelete(false);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        gradTargetLevel === 'all'
                          ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGradTargetLevel('มัธยมศึกษาตอนต้น');
                        setIsConfirmingGradDelete(false);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        gradTargetLevel === 'มัธยมศึกษาตอนต้น'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ม.ต้น (ม.3)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGradTargetLevel('มัธยมศึกษาตอนปลาย');
                        setIsConfirmingGradDelete(false);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        gradTargetLevel === 'มัธยมศึกษาตอนปลาย'
                          ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ม.ปลาย (ม.6)
                    </button>
                  </div>
                </div>

                {/* Graduating Admission Year */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ปี พ.ศ. ที่เข้าศึกษา (≤ ปีนี้)
                  </label>
                  <input
                    type="number"
                    disabled={gradShowAllStudents}
                    value={gradEntryYear}
                    onChange={(e) => {
                      setGradEntryYear(parseInt(e.target.value, 10) || currentAcademicYear - 2);
                      setIsConfirmingGradDelete(false);
                    }}
                    className={`w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-sarabun ${
                      gradShowAllStudents ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                    }`}
                  />
                </div>

                {/* Search Input */}
                <div className="lg:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ค้นหานักเรียนหรือผู้ปกครอง
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={gradSearchQuery}
                      onChange={(e) => setGradSearchQuery(e.target.value)}
                      placeholder="รหัส, ชื่อนร., ห้อง, ชื่อผู้ปกครอง..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-sarabun"
                    />
                  </div>
                </div>
              </div>

              {/* Select All + Show All Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={matchingGradStudents.length === 0}
                    onClick={handleToggleSelectAllGradStudents}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                      matchingGradStudents.length === 0
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : allVisibleGradSelected
                        ? 'bg-rose-600 text-white border-rose-600 cursor-pointer'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {allVisibleGradSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    {allVisibleGradSelected
                      ? `ยกเลิกเลือกทั้งหมดในรายการ (${matchingGradStudents.length})`
                      : `เลือกทั้งหมดในรายการ (${matchingGradStudents.length} คน)`}
                  </button>

                  {selectedGradStudentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGradStudentIds([]);
                        setIsConfirmingGradDelete(false);
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      ล้างที่เลือกทั้งหมด
                    </button>
                  )}

                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gradShowAllStudents}
                      onChange={(e) => {
                        setGradShowAllStudents(e.target.checked);
                        setIsConfirmingGradDelete(false);
                      }}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>แสดงนักเรียนทุกชั้นปี</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                    พบ <strong className="text-slate-900">{matchingGradStudents.length}</strong> คน
                  </span>
                  <span className="px-2.5 py-1 bg-rose-100/80 border border-rose-200 rounded-lg text-rose-800 font-semibold">
                    เลือกแล้ว {selectedGradStudentIds.length} คน • บัตร {selectedGradCardsCount} ใบ
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Student List with Embedded Guardian Pickup Cards */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/60">
              {matchingGradStudents.length > 0 ? (
                matchingGradStudents.map((s) => {
                  const isSelected = selectedGradIdSet.has(s.studentId);
                  const gradeInfo = calculateCurrentGrade(s.level, s.entryYear, currentAcademicYear);
                  const studentCards = cardsByStudentMap.get(s.studentId) || [];

                  return (
                    <div
                      key={s.studentId}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isSelected
                          ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Student Row Header (Clickable Checkbox) */}
                      <div
                        onClick={() => handleToggleGradStudent(s.studentId)}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`shrink-0 transition-colors ${
                              isSelected ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-mono font-bold text-xs">
                                {s.studentId}
                              </span>
                              <span className="font-bold text-slate-800 text-sm font-sarabun">
                                {s.prefix}
                                {s.firstName} {s.lastName}
                              </span>
                              {s.nickname && (
                                <span className="text-xs text-slate-500 font-sarabun">
                                  ({s.nickname})
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-sarabun">
                              <span
                                className={`px-2 py-0.5 rounded-full font-medium ${
                                  s.level === 'มัธยมศึกษาตอนต้น'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {s.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'}
                              </span>
                              <span>ห้อง {s.classroom}</span>
                              <span>•</span>
                              <span>เข้าศึกษา พ.ศ. {s.entryYear}</span>
                              <span>•</span>
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  gradeInfo.isGraduated ? 'text-rose-700' : 'text-emerald-700'
                                }`}
                              >
                                <GraduationCap className="w-3 h-3" />
                                {gradeInfo.gradeLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                              studentCards.length > 0
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            บัตรรับส่ง {studentCards.length} ใบ
                          </span>
                        </div>
                      </div>

                      {/* Guardian Pickup Cards Nested Inside Student Info */}
                      <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 bg-slate-50/70">
                        <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                          บัตรรับส่งของผู้ปกครองภายในข้อมูลนักเรียน ({studentCards.length} ใบ)
                        </div>

                        {studentCards.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {studentCards.map((card) => {
                              const guardian = guardianMap.get(card.guardianId);
                              const statusStyle =
                                card.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : card.status === 'expired'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200';
                              const statusLabel =
                                card.status === 'active'
                                  ? 'ใช้งานปกติ'
                                  : card.status === 'expired'
                                  ? 'หมดอายุ'
                                  : 'ยกเลิกแล้ว';

                              return (
                                <div
                                  key={card.id}
                                  className="p-2.5 bg-white rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs"
                                >
                                  {guardian ? (
                                    <img
                                      src={storageService.resolveImageSrc(
                                        guardian.photoUrl,
                                        guardian.photoAssetId
                                      )}
                                      alt={`${guardian.firstName} ${guardian.lastName}`}
                                      className="w-11 h-14 object-cover rounded-lg border border-slate-200 bg-slate-100 shrink-0"
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
                                  ) : (
                                    <div className="w-11 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                      ไม่มีรูป
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-bold text-xs text-slate-800 truncate font-sarabun">
                                        {guardian
                                          ? `${guardian.prefix}${guardian.firstName} ${guardian.lastName}`
                                          : 'ไม่พบข้อมูลผู้ปกครอง'}
                                      </div>
                                      <span
                                        className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${statusStyle}`}
                                      >
                                        {statusLabel}
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-sarabun">
                                      {guardian?.relation && (
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                                          {guardian.relation}
                                        </span>
                                      )}
                                      {guardian?.phone && (
                                        <span className="inline-flex items-center gap-1 text-slate-500">
                                          <Phone className="w-3 h-3" />
                                          {guardian.phone}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                                      <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                                        <QrCode className="w-3 h-3 text-slate-400" />
                                        {card.qrCodeText || card.id}
                                      </span>
                                      <span>
                                        ออกบัตร {formatThaiDateShort(card.issueDate)} • หมดอายุ{' '}
                                        {formatThaiDateShort(card.expiryDate)}
                                      </span>
                                      {card.printCount > 0 && (
                                        <span className="text-indigo-600 font-medium">
                                          (พิมพ์แล้ว {card.printCount} ครั้ง)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic py-1">
                            ไม่มีบัตรรับส่งของผู้ปกครองที่ผูกอยู่กับนักเรียนคนนี้
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    ไม่พบรายชื่อนักเรียนที่ตรงกับเงื่อนไขการจบการศึกษา
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ลองปรับปี พ.ศ. ที่เข้าศึกษา, เปลี่ยนช่วงชั้น หรือเลือก &ldquo;แสดงนักเรียนทุกชั้นปี&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
              {!isConfirmingGradDelete ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    เลือกทั้งหมด{' '}
                    <strong className="text-rose-600">{selectedGradStudentIds.length}</strong> คน
                    {selectedGradStudentIds.length > 0 && (
                      <span>
                        {' '}
                        (ระบบจะลบบัตรรับส่งที่ผูกอยู่ด้วย{' '}
                        <strong className="text-rose-600">{selectedGradCardsCount}</strong> ใบ)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsGraduationModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                    >
                      ปิดหน้าต่าง
                    </button>
                    <button
                      type="button"
                      disabled={selectedGradStudentIds.length === 0}
                      onClick={() => setIsConfirmingGradDelete(true)}
                      className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all ${
                        selectedGradStudentIds.length > 0
                          ? 'text-white bg-rose-600 hover:bg-rose-700 cursor-pointer'
                          : 'text-slate-400 bg-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบรายชื่อที่เลือก ({selectedGradStudentIds.length} คน)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-xs text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">
                        ยืนยันการลบนักเรียน {selectedGradStudentIds.length} คน และบัตรรับส่ง{' '}
                        {selectedGradCardsCount} ใบ ออกจากระบบถาวรใช่หรือไม่?
                      </div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        การลบนี้ไม่สามารถย้อนกลับได้ และระบบจะลบรูปถ่ายที่ไม่มีผู้ปกครองคนอื่นอ้างอิงออกให้ด้วย
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isExecutingGraduation}
                      onClick={() => setIsConfirmingGradDelete(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="button"
                      disabled={isExecutingGraduation}
                      onClick={handleExecuteGraduation}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isExecutingGraduation ? 'กำลังลบข้อมูล...' : 'ยืนยันลบออกจากระบบ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
