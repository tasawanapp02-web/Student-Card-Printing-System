import React from 'react';
import { BackCardDesignConfig } from '../types';
import { storageService } from '../utils/storage';

interface BackCardPreviewProps {
  design: BackCardDesignConfig;
  scale?: number;
  className?: string;
  isPrintMode?: boolean;
  showBleedGuide?: boolean;
  rotate180?: boolean;
  cardWidthMm?: number;
  cardHeightMm?: number;
}

export const BackCardPreview: React.FC<BackCardPreviewProps> = ({
  design,
  scale = 1,
  className = '',
  isPrintMode = false,
  showBleedGuide = false,
  rotate180 = false,
  cardWidthMm = 85.6,
  cardHeightMm = 54.0,
}) => {
  const baseWidthPx = 323.5;
  const baseHeightPx = 204.1;

  if (isPrintMode) {
    return (
      <div
        className={`relative overflow-hidden print-card-cr80 ${className}`}
        style={{
          width: `${cardWidthMm}mm`,
          height: `${cardHeightMm}mm`,
          boxSizing: 'border-box',
          backgroundColor: design.bgColor || '#ffffff',
          fontFamily: "'Prompt', 'Sarabun', sans-serif",
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          transform: rotate180 ? 'rotate(180deg)' : undefined,
        }}
      >
        {renderBackContent()}
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
        className="relative overflow-hidden rounded-[7px] shadow-md border border-slate-200/80 transition-shadow"
        style={{
          width: `${baseWidthPx}px`,
          height: `${baseHeightPx}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: design.bgColor || '#ffffff',
          fontFamily: "'Prompt', 'Sarabun', sans-serif",
        }}
      >
        <div
          className="w-full h-full relative"
          style={{
            transform: rotate180 ? 'rotate(180deg)' : undefined,
          }}
        >
          {renderBackContent()}
        </div>
        {showBleedGuide && (
          <div className="absolute inset-0 border border-dashed border-red-500/40 pointer-events-none rounded-[7px] z-50" />
        )}
      </div>
    </div>
  );

  function renderBackContent() {
    const resolvedBgSrc = design.bgImageUrl
      ? storageService.resolveImageSrc(design.bgImageUrl, design.bgImageAssetId)
      : '';

    // Full-bleed uploaded PNG/JPG artwork mode
    if (design.displayMode === 'imageOnly') {
      if (resolvedBgSrc) {
        return (
          <img
            src={resolvedBgSrc}
            alt="Back of Card Artwork"
            className="w-full h-full object-fill block"
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
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center">
          <div className="text-[9pt] font-bold text-slate-600">ยังไม่ได้อัปโหลดภาพหลังบัตร</div>
          <div className="text-[7pt] mt-1 font-sarabun">
            กรุณาอัปโหลดไฟล์ .PNG หรือ .JPG ขนาด CR80 (85.6 × 54.0 มม.)
          </div>
        </div>
      );
    }

    // Standard editable template mode (with optional background image behind)
    return (
      <div
        className="w-full h-full relative flex flex-col justify-between overflow-hidden"
        style={{
          backgroundColor: design.bgColor || '#ffffff',
          color: design.textColor || '#1e293b',
        }}
      >
        {/* Optional Background Layer */}
        {resolvedBgSrc && (
          <img
            src={resolvedBgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
            style={{ zIndex: 1 }}
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

        {/* Top Accent Header Band */}
        <div
          className="relative z-10 px-3 py-1.5 flex items-center gap-2 text-white shrink-0"
          style={{ backgroundColor: design.accentColor || '#1e3a8a' }}
        >
          {design.showLogo && (
            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-2xs">
                <polygon
                  points="20,2 38,12 38,28 20,38 2,28 2,12"
                  fill="#fbbf24"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <polygon points="20,6 34,14 34,26 20,34 6,26 6,14" fill="#1e3a8a" />
                <path
                  d="M20,11 L23,17 L30,17 L24,21 L26,27 L20,23 L14,27 L16,21 L10,17 L17,17 Z"
                  fill="#fde047"
                />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[7.5pt] font-bold leading-tight truncate">
              {design.title}
            </div>
            {design.subtitle && (
              <div className="text-[6pt] opacity-90 leading-tight truncate font-sarabun">
                {design.subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Middle Rules & Contact Section */}
        <div className="relative z-10 flex-1 px-3 py-1.5 flex flex-col justify-between overflow-hidden">
          {/* Rules List */}
          <div className="space-y-[2px]">
            {design.rules
              .filter((r) => r.trim().length > 0)
              .slice(0, 5)
              .map((rule, idx) => (
                <div
                  key={idx}
                  className="text-[5.8pt] leading-[1.32] font-sarabun"
                  style={{ color: design.textColor || '#1e293b' }}
                >
                  {rule}
                </div>
              ))}
          </div>

          {/* Bottom Grid: Emergency Contact + Signature Box */}
          <div className="flex items-end justify-between gap-2 pt-1 mt-1 border-t border-slate-200/80">
            <div className="min-w-0 flex-1">
              {(design.emergencyLabel || design.emergencyPhone) && (
                <div
                  className="px-2 py-1 rounded text-white inline-block max-w-full"
                  style={{ backgroundColor: design.accentColor || '#1e3a8a' }}
                >
                  <div className="text-[5pt] opacity-85 leading-none font-sarabun truncate">
                    {design.emergencyLabel}
                  </div>
                  <div className="text-[6.2pt] font-bold leading-tight mt-0.5 font-mono truncate">
                    {design.emergencyPhone}
                  </div>
                </div>
              )}
              {design.footerNote && (
                <div
                  className="text-[5pt] mt-1 leading-tight font-sarabun opacity-80 line-clamp-2"
                  style={{ color: design.textColor || '#475569' }}
                >
                  {design.footerNote}
                </div>
              )}
            </div>

            {design.showSignatureBox && (
              <div className="shrink-0 text-center w-[76px]">
                <div className="h-5 border-b border-dashed border-slate-400 mb-0.5" />
                <div
                  className="text-[4.8pt] font-sarabun leading-tight opacity-85"
                  style={{ color: design.textColor || '#334155' }}
                >
                  {design.signatureLabel || 'ลงชื่อผู้มีอำนาจ'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Accent Strip */}
        <div
          className="relative z-10 h-1.5 w-full shrink-0"
          style={{ backgroundColor: design.accentColor || '#1e3a8a' }}
        />
      </div>
    );
  }
};
