import { Guardian, PickupCard } from '../types';

export const GUARDIAN_RELATION_ORDER = [
  'บิดา',
  'มารดา',
  'เสมือนบิดา',
  'เสมือนมารดา',
  'ปู่',
  'ย่า',
  'ตา',
  'ยาย',
  'ลุง',
  'ป้า',
  'น้า',
  'อา',
  'ผู้ปกครอง',
  'ผู้ปกครองเพื่อน',
  'คนขับรถ',
] as const;

const RELATION_RANK_MAP: Record<string, number> = {
  บิดา: 0,
  มารดา: 1,
  เสมือนบิดา: 2,
  เสมือนมารดา: 3,
  ปู่: 4,
  ย่า: 5,
  'ปู่ / ย่า': 5.5,
  'ปู่/ย่า': 5.5,
  ตา: 6,
  ยาย: 7,
  'ตา / ยาย': 7.5,
  'ตา/ยาย': 7.5,
  ลุง: 8,
  ป้า: 9,
  น้า: 10,
  อา: 11,
  'ลุง / ป้า / น้า / อา': 11.5,
  ผู้ปกครอง: 12,
  ผู้ปกครองเพื่อน: 13,
  คนขับรถ: 14,
};

export function getGuardianRelationRank(relation: string): number {
  const normalized = (relation || '').trim();
  if (normalized in RELATION_RANK_MAP) {
    return RELATION_RANK_MAP[normalized];
  }
  return 999;
}

export function sortCardsByGuardianRelation(
  cards: PickupCard[],
  guardianMap: Map<string, Guardian>
): PickupCard[] {
  return [...cards].sort((a, b) => {
    const gA = guardianMap.get(a.guardianId);
    const gB = guardianMap.get(b.guardianId);
    const rankA = getGuardianRelationRank(gA?.relation || '');
    const rankB = getGuardianRelationRank(gB?.relation || '');

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const relA = (gA?.relation || '').trim();
    const relB = (gB?.relation || '').trim();
    if (relA !== relB) {
      return relA.localeCompare(relB, 'th');
    }

    const nameA = `${gA?.firstName || ''} ${gA?.lastName || ''}`.trim();
    const nameB = `${gB?.firstName || ''} ${gB?.lastName || ''}`.trim();
    const nameCmp = nameA.localeCompare(nameB, 'th');
    if (nameCmp !== 0) return nameCmp;

    return (a.issueDate || '').localeCompare(b.issueDate || '');
  });
}

export function calculateExpectedGraduationBuddhistYear(entryYear: number): {
  academicYearEnd: number;
  calendarYearBE: number;
} {
  const safeEntry = Number.isFinite(entryYear) ? entryYear : 2569;
  return {
    academicYearEnd: safeEntry + 2,
    calendarYearBE: safeEntry + 3,
  };
}
