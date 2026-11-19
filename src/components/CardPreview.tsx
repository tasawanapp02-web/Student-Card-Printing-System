import React, { useEffect, useState } from 'react';
import { CardDesignConfig, Student, Guardian, PickupCard } from '../types';
import { formatThaiDateByFormat } from '../utils/thaiDate';
import { storageService } from '../utils/storage';
import QRCode from 'qrcode';

interface CardPreviewProps {
  design: CardDesignConfig;
  student?: Student;
  guardian?: Guardian;
  card?: PickupCard;
  samplePhotoUrl?: string;
  scale?: number; // scale factor (e.g. 1 = standard screen 324px x 204px)
  className?: string;
  isPrintMode?: boolean; // When in real print tray, uses exact mm styles
  showBleedGuide?: boolean;
  cardWidthMm?: number;
  cardHeightMm?: number;
  hideBorderAndShadow?: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(0, 0, 0, ${alpha})`;
}

function resolveFontWeight(weight: 'normal' | 'bold' | '600', normalDefault = 400): number {
  if (weight === 'bold') return 700;
  if (weight === '600') return 600;
  return normalDefault;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  design,
  student,
  guardian,
  card,
  samplePhotoUrl,
  scale = 1,
  className = '',
  isPrintMode = false,
  showBleedGuide = false,
  cardWidthMm = 85.6,
  cardHeightMm = 54.0,
  hideBorderAndShadow = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Neutral layout placeholders when student/guardian props are omitted (e.g. Card Designer)
  const displayStudent = student || {
    studentId: '00000',
    prefix: '',
    firstName: 'ชื่อ-นามสกุล',
    lastName: 'นักเรียน',
    nickname: '',
    level: design.level,
    classroom: '1/1',
    entryYear: 2569,
    createdAt: '',
    updatedAt: '',
  };

  const displayGuardian = guardian || {
    id: 'guardian_preview',
    prefix: '',
    firstName: 'ชื่อ-นามสกุล',
    lastName: 'ผู้ปกครอง',
    relation: 'ผู้ปกครอง',
    phone: '',
    photoUrl:
      samplePhotoUrl ||
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120"><rect width="100" height="120" fill="%23e2e8f0"/><circle cx="50" cy="40" r="24" fill="%2394a3b8"/><path d="M15 110 c0 -25 18 -40 35 -40 s35 15 35 40 Z" fill="%2364748b"/></svg>',
    photoFileName: 'guardian_photo.jpg',
    createdAt: '',
  };

  const displayIssueDate = card?.issueDate || '2026-05-15';
  const displayExpiryDate = card?.expiryDate || '2029-03-31';

  // Generate QR code for student verification
  useEffect(() => {
    const qrContent =
      card?.qrCodeText ||
      `STUDENT:${displayStudent.studentId}|GUARDIAN:${displayGuardian.firstName} ${displayGuardian.lastName}|EXP:${displayExpiryDate}`;

    QRCode.toDataURL(qrContent, {
      margin: 0,
      width: 120,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code error', err));
  }, [card?.qrCodeText, displayStudent.studentId, displayGuardian.firstName, displayExpiryDate]);

  // Standard CR80 Card Dimensions: 85.6mm x 54.0mm
  // In screen pixels base: 85.6mm * 3.7795 px/mm approx 323.5px x 204.1px
  const baseWidthPx = 323.5;
  const baseHeightPx = 204.1;

  const el = design.elements;
  const isBgAbovePhoto = design.bgLayerAbovePhoto !== false;

  // Print Mode Container vs Screen Container
  if (isPrintMode) {
    return (
      <div
        className={`relative overflow-hidden print-card-cr80 bg-white ${className}`}
        style={{
          width: `${cardWidthMm}mm`,
          height: `${cardHeightMm}mm`,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          fontFamily: "'Prompt', 'Sarabun', sans-serif",
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        {renderCardContent()}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{
        width: `${baseWidthPx * scale}px`,
        height: `${baseHeightPx * scale}px`,
      }}
    >
      <div
        className={`relative overflow-hidden rounded-[7px] bg-white transition-shadow ${
          hideBorderAndShadow
            ? 'shadow-none border-0'
            : 'shadow-md border border-slate-200/80'
        }`}
        style={{
          width: `${baseWidthPx}px`,
          height: `${baseHeightPx}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: '#ffffff',
          fontFamily: "'Prompt', 'Sarabun', sans-serif",
        }}
      >
        {renderCardContent()}
        {showBleedGuide && (
          <div className="absolute inset-0 border border-dashed border-red-500/40 pointer-events-none rounded-[7px] z-50" />
        )}
      </div>
    </div>
  );

  function renderCardContent() {
    // Resolve Guardian Name display
    const guardianLabelText =
      el.guardianName.prefixText !== undefined ? el.guardianName.prefixText : 'ผู้ถือบัตร:';
    const guardianLabelLayout = el.guardianName.labelLayout || 'inline';
    const showGuardianRelation = el.guardianName.showRelation !== false;

    // Resolve Student Name display (NO nickname per requirement)
    const studentLabelText =
      el.studentName.prefixText !== undefined ? el.studentName.prefixText : 'นักเรียน:';
    const studentLabelLayout = el.studentName.labelLayout || 'inline';

    // Resolve Student Class display
    const cleanClassroom = (displayStudent.classroom || '').replace(/^ม\./, '').trim();
    const classMode = el.studentClass.classDisplayMode || 'short_m';
    let studentClassDisplay = `ชั้น ม.${cleanClassroom}`;
    if (classMode === 'custom_prefix') {
      const classPrefix =
        el.studentClass.prefixText !== undefined ? el.studentClass.prefixText : 'ชั้น ม.';
      studentClassDisplay = `${classPrefix}${cleanClassroom}`;
    } else if (classMode === 'custom_text') {
      studentClassDisplay = el.studentClass.customText?.trim()
        ? el.studentClass.customText
        : `ชั้น ม.${cleanClassroom}`;
    }

    // Resolve Student ID display
    const studentIdNumbersOnly = Boolean(el.studentId.numbersOnly);
    const studentIdPrefix =
      el.studentId.prefixText !== undefined ? el.studentId.prefixText : 'รหัส:';
    const studentIdShowBg =
      el.studentId.showBackground !== undefined ? el.studentId.showBackground : true;
    const studentIdBgColor = hexToRgba(
      el.studentId.backgroundColor || '#000000',
      el.studentId.backgroundOpacity !== undefined ? el.studentId.backgroundOpacity : 0.25
    );

    // Resolve Dates display
    const issueDatePrefix =
      el.issueDate.prefixText !== undefined ? el.issueDate.prefixText : 'ออกบัตร:';
    const issueDateFormatted = formatThaiDateByFormat(
      displayIssueDate,
      el.issueDate.dateFormat || 'short'
    );
    const expiryDatePrefix =
      el.expiryDate.prefixText !== undefined ? el.expiryDate.prefixText : 'หมดอายุ:';
    const expiryDateFormatted = formatThaiDateByFormat(
      displayExpiryDate,
      el.expiryDate.dateFormat || 'short'
    );

    const rawPhotoRef = guardian?.photoUrl || samplePhotoUrl || displayGuardian.photoUrl;
    const resolvedPhotoSrc =
      storageService.resolveImageSrc(rawPhotoRef, guardian?.photoAssetId) ||
      displayGuardian.photoUrl;
    const resolvedBgSrc = design.bgImageUrl
      ? storageService.resolveImageSrc(design.bgImageUrl, design.bgImageAssetId)
      : '';

    return (
      <>
        {/* 1. Guardian Photo Layer - Placed UNDER the PNG background when isBgAbovePhoto is true */}
        {el.guardianPhoto?.visible && (
          <div
            className="absolute overflow-hidden shadow-xs flex items-center justify-center bg-white"
            style={{
              left: `${(el.guardianPhoto.x / 85.6) * 100}%`,
              top: `${(el.guardianPhoto.y / 54.0) * 100}%`,
              width: `${((el.guardianPhoto.width || 25) / 85.6) * 100}%`,
              height: `${((el.guardianPhoto.height || 29) / 54.0) * 100}%`,
              borderRadius: `${el.guardianPhoto.borderRadius || 4}px`,
              border: `${el.guardianPhoto.borderWidth || 1.5}px solid ${el.guardianPhoto.borderColor || '#ffffff'}`,
              zIndex: isBgAbovePhoto ? 10 : 25,
            }}
          >
            <img
              src={resolvedPhotoSrc}
              alt="Guardian"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                const fallbackData = storageService.getImageFallbackDataUrl(
                  rawPhotoRef,
                  guardian?.photoAssetId
                );
                if (fallbackData && img.src !== fallbackData) {
                  img.src = fallbackData;
                  return;
                }
                img.src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" fill="%2394a3b8"><rect width="100" height="120"/><circle cx="50" cy="40" r="25" fill="%23ffffff"/><circle cx="50" cy="95" r="40" fill="%23ffffff"/></svg>';
              }}
            />
          </div>
        )}

        {/* 2. Background Image / .PNG Overlay Layer */}
        {resolvedBgSrc && (
          <img
            src={resolvedBgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
            style={{ zIndex: isBgAbovePhoto ? 20 : 5 }}
            onError={(e) => {
              const img = e.currentTarget;
              const fallbackData = storageService.getImageFallbackDataUrl(
                design.bgImageUrl,
                design.bgImageAssetId
              );
              if (fallbackData && img.src !== fallbackData) {
                img.src = fallbackData;
              }
            }}
          />
        )}

        {/* 3. School Crest Logo */}
        {el.schoolLogo?.visible && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: `${(el.schoolLogo.x / 85.6) * 100}%`,
              top: `${(el.schoolLogo.y / 54.0) * 100}%`,
              width: `${((el.schoolLogo.width || 14) / 85.6) * 100}%`,
              height: `${((el.schoolLogo.height || 14) / 54.0) * 100}%`,
              zIndex: 30,
            }}
          >
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-xs">
              <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
              <polygon points="20,6 34,14 34,26 20,34 6,26 6,14" fill="#1e3a8a" />
              <path d="M20,11 L23,17 L30,17 L24,21 L26,27 L20,23 L14,27 L16,21 L10,17 L17,17 Z" fill="#fde047" />
            </svg>
          </div>
        )}

        {/* 4. Title Header */}
        {el.title?.visible && (
          <div
            className="absolute leading-tight whitespace-nowrap drop-shadow-xs"
            style={{
              left: `${(el.title.x / 85.6) * 100}%`,
              top: `${(el.title.y / 54.0) * 100}%`,
              fontSize: `${el.title.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.title.fontWeight, 500),
              fontFamily: el.title.fontFamily || "'Prompt', sans-serif",
              color: el.title.color,
              textAlign: el.title.textAlign,
              zIndex: 30,
            }}
          >
            {design.title}
          </div>
        )}

        {/* 5. Subtitle / School Name */}
        {el.subtitle?.visible && (
          <div
            className="absolute leading-tight whitespace-nowrap"
            style={{
              left: `${(el.subtitle.x / 85.6) * 100}%`,
              top: `${(el.subtitle.y / 54.0) * 100}%`,
              fontSize: `${el.subtitle.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.subtitle.fontWeight, 400),
              fontFamily: el.subtitle.fontFamily || "'Sarabun', sans-serif",
              color: el.subtitle.color,
              textAlign: el.subtitle.textAlign,
              zIndex: 30,
            }}
          >
            {design.subtitle}
          </div>
        )}

        {/* 6. Guardian Name (ผู้ถือบัตร) */}
        {el.guardianName?.visible && (
          <div
            className="absolute whitespace-nowrap"
            style={{
              left: `${(el.guardianName.x / 85.6) * 100}%`,
              top: `${(el.guardianName.y / 54.0) * 100}%`,
              fontSize: `${el.guardianName.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.guardianName.fontWeight, 500),
              fontFamily: el.guardianName.fontFamily || "'Prompt', sans-serif",
              lineHeight: el.guardianName.lineHeight ?? 1.25,
              color: el.guardianName.color,
              textAlign: el.guardianName.textAlign,
              zIndex: 30,
            }}
          >
            {guardianLabelLayout === 'newline' && guardianLabelText.trim() !== '' ? (
              <>
                <div style={{ fontSize: '0.78em', opacity: 0.85, fontWeight: 400 }}>
                  {guardianLabelText}
                </div>
                <div>
                  <span>
                    {displayGuardian.prefix}
                    {displayGuardian.firstName} {displayGuardian.lastName}
                  </span>
                  {showGuardianRelation && (
                    <span style={{ fontSize: '0.78em', opacity: 0.85, fontWeight: 400, marginLeft: '3px' }}>
                      ({displayGuardian.relation})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {guardianLabelLayout !== 'hidden' && guardianLabelText.trim() !== '' && (
                  <span style={{ fontSize: '0.78em', opacity: 0.85, fontWeight: 400, marginRight: '3px' }}>
                    {guardianLabelText}
                  </span>
                )}
                <span>
                  {displayGuardian.prefix}
                  {displayGuardian.firstName} {displayGuardian.lastName}
                </span>
                {showGuardianRelation && (
                  <span style={{ fontSize: '0.78em', opacity: 0.85, fontWeight: 400, marginLeft: '3px' }}>
                    ({displayGuardian.relation})
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* 7. Student Name (NO Nickname) */}
        {el.studentName?.visible && (
          <div
            className="absolute whitespace-nowrap"
            style={{
              left: `${(el.studentName.x / 85.6) * 100}%`,
              top: `${(el.studentName.y / 54.0) * 100}%`,
              fontSize: `${el.studentName.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.studentName.fontWeight, 400),
              fontFamily: el.studentName.fontFamily || "'Sarabun', sans-serif",
              lineHeight: el.studentName.lineHeight ?? 1.25,
              color: el.studentName.color,
              textAlign: el.studentName.textAlign,
              zIndex: 30,
            }}
          >
            {studentLabelLayout === 'newline' && studentLabelText.trim() !== '' ? (
              <>
                <div style={{ fontSize: '0.82em', opacity: 0.85, fontWeight: 400 }}>
                  {studentLabelText}
                </div>
                <div>
                  {displayStudent.prefix}
                  {displayStudent.firstName} {displayStudent.lastName}
                </div>
              </>
            ) : (
              <>
                {studentLabelLayout !== 'hidden' && studentLabelText.trim() !== '' && (
                  <span style={{ fontSize: '0.82em', opacity: 0.85, fontWeight: 400, marginRight: '3px' }}>
                    {studentLabelText}
                  </span>
                )}
                <span>
                  {displayStudent.prefix}
                  {displayStudent.firstName} {displayStudent.lastName}
                </span>
              </>
            )}
          </div>
        )}

        {/* 8. Class / Room */}
        {el.studentClass?.visible && (
          <div
            className="absolute whitespace-nowrap"
            style={{
              left: `${(el.studentClass.x / 85.6) * 100}%`,
              top: `${(el.studentClass.y / 54.0) * 100}%`,
              fontSize: `${el.studentClass.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.studentClass.fontWeight, 400),
              fontFamily: el.studentClass.fontFamily || "'Sarabun', sans-serif",
              lineHeight: el.studentClass.lineHeight ?? 1.25,
              color: el.studentClass.color,
              textAlign: el.studentClass.textAlign,
              zIndex: 30,
            }}
          >
            {studentClassDisplay}
          </div>
        )}

        {/* 9. 5-digit Student ID */}
        {el.studentId?.visible && (
          <div
            className="absolute whitespace-nowrap"
            style={{
              left: `${(el.studentId.x / 85.6) * 100}%`,
              top: `${(el.studentId.y / 54.0) * 100}%`,
              fontSize: `${el.studentId.fontSize * 0.9}pt`,
              fontWeight: el.studentId.fontWeight === 'bold' ? 800 : resolveFontWeight(el.studentId.fontWeight, 500),
              fontFamily:
                el.studentId.fontFamily ||
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              lineHeight: el.studentId.lineHeight ?? 1.2,
              color: el.studentId.color,
              textAlign: el.studentId.textAlign,
              zIndex: 30,
            }}
          >
            {!studentIdNumbersOnly && studentIdPrefix.trim() !== '' && (
              <span style={{ fontSize: '0.82em', fontWeight: 400, opacity: 0.85, marginRight: '3px' }}>
                {studentIdPrefix}
              </span>
            )}
            <span
              className="tracking-wider"
              style={
                studentIdShowBg
                  ? {
                      backgroundColor: studentIdBgColor,
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }
                  : undefined
              }
            >
              {displayStudent.studentId}
            </span>
          </div>
        )}

        {/* 10. QR Code */}
        {el.qrCode?.visible && qrDataUrl && (
          <div
            className="absolute bg-white p-0.5 rounded-sm shadow-xs flex items-center justify-center"
            style={{
              left: `${(el.qrCode.x / 85.6) * 100}%`,
              top: `${(el.qrCode.y / 54.0) * 100}%`,
              width: `${((el.qrCode.width || 13) / 85.6) * 100}%`,
              height: `${((el.qrCode.height || 13) / 54.0) * 100}%`,
              zIndex: 30,
            }}
          >
            <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
          </div>
        )}

        {/* 11. Issue Date */}
        {el.issueDate?.visible && (
          <div
            className="absolute leading-tight whitespace-nowrap"
            style={{
              left: `${(el.issueDate.x / 85.6) * 100}%`,
              top: `${(el.issueDate.y / 54.0) * 100}%`,
              fontSize: `${el.issueDate.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.issueDate.fontWeight, 400),
              fontFamily: el.issueDate.fontFamily || "'Sarabun', sans-serif",
              color: el.issueDate.color,
              textAlign: el.issueDate.textAlign,
              zIndex: 30,
            }}
          >
            {issueDatePrefix ? `${issueDatePrefix} ${issueDateFormatted}` : issueDateFormatted}
          </div>
        )}

        {/* 12. Expiry Date */}
        {el.expiryDate?.visible && (
          <div
            className="absolute leading-tight whitespace-nowrap"
            style={{
              left: `${(el.expiryDate.x / 85.6) * 100}%`,
              top: `${(el.expiryDate.y / 54.0) * 100}%`,
              fontSize: `${el.expiryDate.fontSize * 0.9}pt`,
              fontWeight: resolveFontWeight(el.expiryDate.fontWeight, 500),
              fontFamily: el.expiryDate.fontFamily || "'Sarabun', sans-serif",
              color: el.expiryDate.color,
              textAlign: el.expiryDate.textAlign,
              zIndex: 30,
            }}
          >
            {expiryDatePrefix ? `${expiryDatePrefix} ${expiryDateFormatted}` : expiryDateFormatted}
          </div>
        )}
      </>
    );
  }
};
