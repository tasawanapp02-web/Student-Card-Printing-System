import React from 'react';
import {
  CardDesignConfig,
  Guardian,
  PickupCard,
  Student,
} from '../types';
import { CardPreview } from './CardPreview';
import {
  calculateCurrentGrade,
  formatThaiDateFull,
  formatThaiDateShort,
} from '../utils/thaiDate';

export interface RegistryPrintSheetProps {
  student: Student;
  cards: PickupCard[];
  guardianMap: Map<string, Guardian>;
  frontDesign: CardDesignConfig;
  currentAcademicYear: number;
  paperOrientation: 'portrait' | 'landscape';
  columnsPerRow: 1 | 2;
  repeatHeader: boolean;
  showPageNumbers: boolean;
  headerTitle: string;
  headerSubtitle: string;
  reportDate: string;
  zoom?: number;
  isPrintMode?: boolean;
}

const MM_TO_PX = 3.7795275591;

interface SheetGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  marginXMm: number;
  marginYMm: number;
  contentWidthMm: number;
  cardRenderWidthMm: number;
  cardRenderHeightMm: number;
  cardScale: number;
  rowHeightMm: number;
  rowGapMm: number;
  colGapMm: number;
  headerBlockHeightMm: number;
  studentBoxHeightMm: number;
  repeatStudentStripMm: number;
  footerHeightMm: number;
  firstPageRows: number;
  nextPageRows: number;
}

export function getRegistrySheetGeometry(
  paperOrientation: 'portrait' | 'landscape',
  columnsPerRow: 1 | 2,
  hasHeader: boolean,
  hasSubtitle: boolean,
  repeatHeader: boolean,
  showPageNumbers: boolean
): SheetGeometry {
  const pageWidthMm = paperOrientation === 'portrait' ? 210 : 297;
  const pageHeightMm = paperOrientation === 'portrait' ? 297 : 210;
  const marginXMm = 11;
  const marginYMm = 10;
  const contentWidthMm = pageWidthMm - marginXMm * 2;
  const colGapMm = 4;
  const rowGapMm = 3.5;

  let cardRenderWidthMm = 76;
  let rowHeightMm = 52;

  if (paperOrientation === 'portrait') {
    if (columnsPerRow === 1) {
      cardRenderWidthMm = 76; // 76 x 47.94 mm
      rowHeightMm = 52;
    } else {
      cardRenderWidthMm = 42.8; // 42.8 x 27.0 mm
      rowHeightMm = 34;
    }
  } else {
    if (columnsPerRow === 1) {
      cardRenderWidthMm = 82; // 82 x 51.73 mm
      rowHeightMm = 55;
    } else {
      cardRenderWidthMm = 58; // 58 x 36.59 mm
      rowHeightMm = 41.5;
    }
  }

  const cardScale = cardRenderWidthMm / 85.6;
  const cardRenderHeightMm = Number((54.0 * cardScale).toFixed(2));

  const headerBlockHeightMm = hasHeader ? (hasSubtitle ? 18 : 13) : 0;
  const studentBoxHeightMm = paperOrientation === 'portrait' ? 39 : 33;
  const repeatStudentStripMm = 9;
  const footerHeightMm = showPageNumbers ? 8 : 0;
  const sectionTitleMm = 7;

  const usableHeightMm = pageHeightMm - marginYMm * 2 - footerHeightMm;

  const firstPageAvailable =
    usableHeightMm - headerBlockHeightMm - studentBoxHeightMm - sectionTitleMm - 3;
  const nextPageAvailable =
    usableHeightMm -
    (repeatHeader ? headerBlockHeightMm + repeatStudentStripMm : 0) -
    sectionTitleMm -
    2;

  const firstPageRows = Math.max(
    1,
    Math.floor((firstPageAvailable + rowGapMm) / (rowHeightMm + rowGapMm))
  );
  const nextPageRows = Math.max(
    1,
    Math.floor((nextPageAvailable + rowGapMm) / (rowHeightMm + rowGapMm))
  );

  return {
    pageWidthMm,
    pageHeightMm,
    marginXMm,
    marginYMm,
    contentWidthMm,
    cardRenderWidthMm,
    cardRenderHeightMm,
    cardScale,
    rowHeightMm,
    rowGapMm,
    colGapMm,
    headerBlockHeightMm,
    studentBoxHeightMm,
    repeatStudentStripMm,
    footerHeightMm,
    firstPageRows,
    nextPageRows,
  };
}

export function paginateRegistryCards(
  cards: PickupCard[],
  columnsPerRow: 1 | 2,
  firstPageRows: number,
  nextPageRows: number
): PickupCard[][] {
  if (cards.length === 0) return [[]];
  const pages: PickupCard[][] = [];
  const firstCapacity = firstPageRows * columnsPerRow;
  const nextCapacity = nextPageRows * columnsPerRow;

  pages.push(cards.slice(0, firstCapacity));
  let offset = firstCapacity;
  while (offset < cards.length) {
    pages.push(cards.slice(offset, offset + nextCapacity));
    offset += nextCapacity;
  }
  return pages;
}

export const RegistryPrintSheet: React.FC<RegistryPrintSheetProps> = ({
  student,
  cards,
  guardianMap,
  frontDesign,
  currentAcademicYear,
  paperOrientation,
  columnsPerRow,
  repeatHeader,
  showPageNumbers,
  headerTitle,
  headerSubtitle,
  reportDate,
  zoom = 1,
  isPrintMode = false,
}) => {
  const cleanTitle = headerTitle.trim();
  const cleanSubtitle = headerSubtitle.trim();
  const geo = getRegistrySheetGeometry(
    paperOrientation,
    columnsPerRow,
    Boolean(cleanTitle || cleanSubtitle),
    Boolean(cleanSubtitle),
    repeatHeader,
    showPageNumbers
  );

  const pages = paginateRegistryCards(
    cards,
    columnsPerRow,
    geo.firstPageRows,
    geo.nextPageRows
  );

  const gradeInfo = calculateCurrentGrade(
    student.level,
    student.entryYear,
    currentAcademicYear
  );
  const studentFullName = `${student.prefix}${student.firstName} ${student.lastName}`.trim();
  const formattedReportDate = formatThaiDateFull(reportDate);

  const scaledW = geo.pageWidthMm * MM_TO_PX * zoom;
  const scaledH = geo.pageHeightMm * MM_TO_PX * zoom;

  let runningIndex = 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPrintMode ? '0px' : '24px',
      }}
    >
      {pages.map((pageCards, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === pages.length - 1;
        const startIdxForPage = runningIndex;
        runningIndex += pageCards.length;

        const sheetNode = (
          <div
            className="registry-print-sheet bg-white text-slate-900"
            style={{
              width: `${geo.pageWidthMm}mm`,
              height: `${geo.pageHeightMm}mm`,
              padding: `${geo.marginYMm}mm ${geo.marginXMm}mm`,
              boxSizing: 'border-box',
              position: 'relative',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: isPrintMode
                ? 'none'
                : '0 20px 25px -5px rgba(15, 23, 42, 0.14), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
              border: isPrintMode ? 'none' : '1px solid #cbd5e1',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter: isLastPage ? 'auto' : 'page',
              fontFamily: "'Sarabun', 'Prompt', sans-serif",
            }}
          >
            {/* Custom Header Block (Page 1 always, Page 2+ if repeatHeader enabled) */}
            {(isFirstPage || repeatHeader) && (cleanTitle || cleanSubtitle) && (
              <div
                style={{
                  borderBottom: '0.4mm solid #1e3a8a',
                  paddingBottom: '2mm',
                  marginBottom: '2.5mm',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '4mm',
                  flexShrink: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {cleanTitle && (
                    <div
                      style={{
                        fontSize: '13pt',
                        fontWeight: 700,
                        color: '#0f172a',
                        lineHeight: 1.25,
                        fontFamily: "'Prompt', 'Sarabun', sans-serif",
                      }}
                    >
                      {cleanTitle}
                    </div>
                  )}
                  {cleanSubtitle && (
                    <div
                      style={{
                        fontSize: '9.5pt',
                        color: '#475569',
                        lineHeight: 1.3,
                        marginTop: '0.5mm',
                      }}
                    >
                      {cleanSubtitle}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '8.5pt',
                    color: '#475569',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <div>วันที่พิมพ์: {formattedReportDate}</div>
                  {!isFirstPage && (
                    <div style={{ fontWeight: 600, color: '#1e3a8a' }}>
                      รหัส {student.studentId} • {studentFullName}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compact Student Strip on Subsequent Pages when Repeating Header */}
            {!isFirstPage && repeatHeader && !(cleanTitle || cleanSubtitle) && (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '0.25mm solid #cbd5e1',
                  borderRadius: '1.5mm',
                  padding: '1.5mm 3mm',
                  marginBottom: '2.5mm',
                  fontSize: '8.5pt',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span>
                  <strong>ทะเบียนบัตรผู้ปกครอง:</strong> {studentFullName} (รหัส{' '}
                  {student.studentId} • {gradeInfo.gradeLabel}/{student.classroom})
                </span>
                <span style={{ color: '#475569' }}>วันที่: {formattedReportDate}</span>
              </div>
            )}

            {/* Box 1: Full Student Information (Page 1) */}
            {isFirstPage && (
              <div
                style={{
                  border: '0.35mm solid #bfdbfe',
                  backgroundColor: '#f8fafc',
                  borderRadius: '2mm',
                  padding: '2.5mm 3.5mm',
                  marginBottom: '3mm',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '0.2mm solid #dbeafe',
                    paddingBottom: '1.5mm',
                    marginBottom: '2mm',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10.5pt',
                      fontWeight: 700,
                      color: '#1e3a8a',
                      fontFamily: "'Prompt', 'Sarabun', sans-serif",
                    }}
                  >
                    ข้อมูลนักเรียน ({student.level})
                  </div>
                  <div style={{ fontSize: '9pt', color: '#334155' }}>
                    <strong>จำนวนบัตร:</strong> {cards.length} ใบ • <strong>วันที่:</strong>{' '}
                    {formattedReportDate}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '1.5mm 3.5mm',
                    fontSize: '9.2pt',
                    lineHeight: 1.35,
                    color: '#1e293b',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b' }}>รหัสนักเรียน: </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '9.5pt' }}>
                      {student.studentId}
                    </strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>ชื่อ-นามสกุล: </span>
                    <strong>{studentFullName}</strong>
                    {student.nickname ? (
                      <span style={{ color: '#475569' }}> (ชื่อเล่น: {student.nickname})</span>
                    ) : null}
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>เข้ารับการศึกษา: </span>
                    <strong>ปีการศึกษาที่ {student.entryYear}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>กำลังศึกษา: </span>
                    <strong>
                      {gradeInfo.gradeLabel} / ห้อง {student.classroom} ปีการศึกษาที่{' '}
                      {currentAcademicYear}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>คาดว่าจบการศึกษา: </span>
                    <strong style={{ color: '#047857' }}>
                      ปีการศึกษาที่ {student.entryYear + 2}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Box 2 Title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '2mm',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '10pt',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: "'Prompt', 'Sarabun', sans-serif",
                }}
              >
                รายการบัตรรับส่งผู้ปกครองนักเรียน (เรียงตามลำดับความสัมพันธ์)
              </div>
              <div style={{ fontSize: '8.5pt', color: '#64748b' }}>
                {cards.length > 0
                  ? `แสดงลำดับที่ ${startIdxForPage + 1} - ${startIdxForPage + pageCards.length} จากทั้งหมด ${cards.length} ใบ`
                  : 'ยังไม่มีบัตรรับส่งที่ผูกกับนักเรียนคนนี้'}
              </div>
            </div>

            {/* Cards Grid */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                gridAutoRows: `${geo.rowHeightMm}mm`,
                gap: `${geo.rowGapMm}mm ${geo.colGapMm}mm`,
                alignContent: 'start',
              }}
            >
              {cards.length === 0 ? (
                <div
                  style={{
                    gridColumn: `span ${columnsPerRow}`,
                    border: '0.3mm dashed #cbd5e1',
                    borderRadius: '2mm',
                    padding: '10mm',
                    textAlign: 'center',
                    fontSize: '9.5pt',
                    color: '#64748b',
                  }}
                >
                  ไม่พบบัตรรับส่งผู้ปกครองสำหรับนักเรียนรหัส {student.studentId}
                </div>
              ) : (
                pageCards.map((card, localIdx) => {
                  const globalIdx = startIdxForPage + localIdx;
                  const guardian = guardianMap.get(card.guardianId);
                  const guardianFullName = guardian
                    ? `${guardian.prefix}${guardian.firstName} ${guardian.lastName}`.trim()
                    : 'ไม่พบข้อมูลผู้ปกครอง';
                  const relationLabel = guardian?.relation || '-';
                  const isCompact = columnsPerRow === 2 && paperOrientation === 'portrait';

                  return (
                    <div
                      key={card.id}
                      style={{
                        border: '0.28mm solid #cbd5e1',
                        borderRadius: '2mm',
                        backgroundColor: '#ffffff',
                        padding: isCompact ? '1.8mm' : '2mm 2.5mm',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCompact ? '2mm' : '3.5mm',
                        height: `${geo.rowHeightMm}mm`,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        breakInside: 'avoid',
                      }}
                    >
                      {/* Left: Guardian Card Image Preview */}
                      <div
                        style={{
                          width: `${geo.cardRenderWidthMm}mm`,
                          height: `${geo.cardRenderHeightMm}mm`,
                          flexShrink: 0,
                          overflow: 'hidden',
                          borderRadius: '1.5mm',
                          border: '0.2mm solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            width: '85.6mm',
                            height: '54.0mm',
                            transform: `scale(${geo.cardScale})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          <CardPreview
                            design={frontDesign}
                            student={student}
                            guardian={guardian}
                            card={card}
                            isPrintMode={true}
                            cardWidthMm={85.6}
                            cardHeightMm={54.0}
                          />
                        </div>
                      </div>

                      {/* Right: Guardian Details */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: isCompact ? '0.7mm' : '1.1mm',
                          fontSize: isCompact ? '7.5pt' : '9pt',
                          lineHeight: 1.28,
                          color: '#1e293b',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1.5mm',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '0.2mm solid #bfdbfe',
                              borderRadius: '1mm',
                              padding: isCompact ? '0.2mm 1.2mm' : '0.4mm 1.8mm',
                              fontSize: isCompact ? '7pt' : '8.2pt',
                              fontWeight: 700,
                            }}
                          >
                            {relationLabel}
                          </span>
                          <span
                            style={{
                              fontSize: isCompact ? '6.8pt' : '7.8pt',
                              color: '#64748b',
                              fontFamily: 'monospace',
                            }}
                          >
                            #{globalIdx + 1}
                          </span>
                        </div>

                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: isCompact ? '8pt' : '10pt',
                            color: '#0f172a',
                            wordBreak: 'break-word',
                          }}
                        >
                          {guardianFullName}
                        </div>

                        <div style={{ color: '#334155' }}>
                          <span style={{ color: '#64748b' }}>ความสัมพันธ์: </span>
                          <strong>{relationLabel}</strong>
                        </div>

                        <div style={{ color: '#334155' }}>
                          <span style={{ color: '#64748b' }}>วันที่ออกบัตร: </span>
                          <span>{formatThaiDateShort(card.issueDate)}</span>
                        </div>

                        <div style={{ color: '#334155' }}>
                          <span style={{ color: '#64748b' }}>วันที่หมดอายุ: </span>
                          <span>{formatThaiDateShort(card.expiryDate)}</span>
                        </div>

                        {!isCompact && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2mm',
                              fontSize: '7.5pt',
                              color: '#64748b',
                              marginTop: '0.3mm',
                            }}
                          >
                            <span>
                              สถานะ:{' '}
                              <strong
                                style={{
                                  color:
                                    card.status === 'active'
                                      ? '#047857'
                                      : card.status === 'expired'
                                      ? '#b45309'
                                      : '#be123c',
                                }}
                              >
                                {card.status === 'active'
                                  ? 'ใช้งานได้'
                                  : card.status === 'expired'
                                  ? 'หมดอายุ'
                                  : 'ยกเลิก'}
                              </strong>
                            </span>
                            {guardian?.phone ? <span>• โทร. {guardian.phone}</span> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Page Number */}
            {showPageNumbers && (
              <div
                style={{
                  borderTop: '0.2mm solid #e2e8f0',
                  paddingTop: '1.5mm',
                  marginTop: '2mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '8pt',
                  color: '#64748b',
                  flexShrink: 0,
                }}
              >
                <span>
                  ทะเบียนบัตรผู้ปกครอง • {student.studentId} {studentFullName}
                </span>
                <span style={{ fontWeight: 700, color: '#334155' }}>
                  หน้า {pageIdx + 1} / {pages.length}
                </span>
              </div>
            )}
          </div>
        );

        if (isPrintMode) {
          return <React.Fragment key={`reg_page_${pageIdx}`}>{sheetNode}</React.Fragment>;
        }

        return (
          <div
            key={`reg_page_${pageIdx}`}
            style={{
              width: `${scaledW}px`,
              height: `${scaledH}px`,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${geo.pageWidthMm}mm`,
                height: `${geo.pageHeightMm}mm`,
              }}
            >
              {sheetNode}
            </div>
          </div>
        );
      })}
    </div>
  );
};
