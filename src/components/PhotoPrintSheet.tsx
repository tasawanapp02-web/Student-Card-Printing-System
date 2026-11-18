import React from 'react';
import {
  Guardian,
  ImageAsset,
  PhotoHorizontalAlign,
  PhotoMarginsMm,
  PhotoPrintLayout,
  PhotoVerticalAlign,
} from '../types';
import { storageService } from '../utils/storage';

export interface PhotoPrintSheetProps {
  assets: ImageAsset[];
  layout: PhotoPrintLayout;
  paperOrientation: 'portrait' | 'landscape';
  gapMm: number;
  horizontalAlign?: PhotoHorizontalAlign;
  verticalAlign?: PhotoVerticalAlign;
  marginsMm?: PhotoMarginsMm;
  showCutLines: boolean;
  stripExtension: boolean;
  showGuardianName: boolean;
  fitMode: 'cover' | 'contain';
  guardians: Guardian[];
  zoom?: number;
  isPrintMode?: boolean;
}

const MM_TO_PX = 3.7795275591;

export const DEFAULT_PHOTO_MARGINS_MM: PhotoMarginsMm = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

function sanitizeMargins(margins?: PhotoMarginsMm): PhotoMarginsMm {
  const clamp = (val: number | undefined, fallback: number) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.min(80, val)) : fallback;
  return {
    top: clamp(margins?.top, DEFAULT_PHOTO_MARGINS_MM.top),
    right: clamp(margins?.right, DEFAULT_PHOTO_MARGINS_MM.right),
    bottom: clamp(margins?.bottom, DEFAULT_PHOTO_MARGINS_MM.bottom),
    left: clamp(margins?.left, DEFAULT_PHOTO_MARGINS_MM.left),
  };
}

export function getPhotoPrintSheetMetrics(
  layout: PhotoPrintLayout,
  paperOrientation: 'portrait' | 'landscape',
  gapMm: number,
  showGuardianName: boolean,
  marginsMm?: PhotoMarginsMm
) {
  const safeGap = Math.max(0.5, Number.isFinite(gapMm) ? gapMm : 0.5);
  const margins = sanitizeMargins(marginsMm);
  const pageWidthMm = paperOrientation === 'portrait' ? 210 : 297;
  const pageHeightMm = paperOrientation === 'portrait' ? 297 : 210;
  const printableWidthMm = Math.max(30, pageWidthMm - margins.left - margins.right);
  const printableHeightMm = Math.max(40, pageHeightMm - margins.top - margins.bottom);
  const cellWidthMm = 30;
  const labelHeightMm = showGuardianName ? 11 : 7;
  const cellHeightMm = 40 + labelHeightMm;

  const perPage =
    layout === 'vertical'
      ? Math.max(1, Math.floor((printableHeightMm + safeGap) / (cellHeightMm + safeGap)))
      : Math.max(1, Math.floor((printableWidthMm + safeGap) / (cellWidthMm + safeGap)));

  return {
    pageWidthMm,
    pageHeightMm,
    margins,
    safeGap,
    printableWidthMm,
    printableHeightMm,
    cellWidthMm,
    cellHeightMm,
    perPage,
  };
}

export function paginatePhotoPrintAssets(
  assets: ImageAsset[],
  layout: PhotoPrintLayout,
  paperOrientation: 'portrait' | 'landscape',
  gapMm: number,
  showGuardianName: boolean,
  marginsMm?: PhotoMarginsMm
): ImageAsset[][] {
  if (assets.length === 0) return [];
  const { perPage } = getPhotoPrintSheetMetrics(
    layout,
    paperOrientation,
    gapMm,
    showGuardianName,
    marginsMm
  );
  const pages: ImageAsset[][] = [];
  for (let i = 0; i < assets.length; i += perPage) {
    pages.push(assets.slice(i, i + perPage));
  }
  return pages;
}

function resolveLinkedGuardianLabel(asset: ImageAsset, guardians: Guardian[]): string {
  const assetRefUri = `firestore-asset://${asset.id}`;
  const matched = guardians.find(
    (g) =>
      g.photoAssetId === asset.id ||
      g.photoUrl === assetRefUri ||
      Boolean(asset.storageUrl && g.photoUrl === asset.storageUrl) ||
      Boolean(asset.storagePath && g.photoStoragePath === asset.storagePath) ||
      Boolean(asset.dataUrl && g.photoUrl === asset.dataUrl)
  );
  if (!matched) return '';
  return `${matched.prefix}${matched.firstName} ${matched.lastName}`.trim();
}

function mapHorizontalFlex(align: PhotoHorizontalAlign): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function mapVerticalFlex(align: PhotoVerticalAlign): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'top') return 'flex-start';
  if (align === 'bottom') return 'flex-end';
  return 'center';
}

export const PhotoPrintSheet: React.FC<PhotoPrintSheetProps> = ({
  assets,
  layout,
  paperOrientation,
  gapMm,
  horizontalAlign = 'center',
  verticalAlign = 'top',
  marginsMm,
  showCutLines,
  stripExtension,
  showGuardianName,
  fitMode,
  guardians,
  zoom = 1,
  isPrintMode = false,
}) => {
  const metrics = getPhotoPrintSheetMetrics(
    layout,
    paperOrientation,
    gapMm,
    showGuardianName,
    marginsMm
  );
  const pages = paginatePhotoPrintAssets(
    assets,
    layout,
    paperOrientation,
    gapMm,
    showGuardianName,
    marginsMm
  );

  if (pages.length === 0) {
    return null;
  }

  const justifyContent =
    layout === 'vertical'
      ? mapVerticalFlex(verticalAlign)
      : mapHorizontalFlex(horizontalAlign);
  const alignItems =
    layout === 'vertical'
      ? mapHorizontalFlex(horizontalAlign)
      : mapVerticalFlex(verticalAlign);

  return (
    <div className="flex flex-col items-center gap-5 print:block print:gap-0">
      {pages.map((pageAssets, pageIdx) => {
        const isLastPage = pageIdx === pages.length - 1;
        const scaledW = Math.round(metrics.pageWidthMm * MM_TO_PX * zoom);
        const scaledH = Math.round(metrics.pageHeightMm * MM_TO_PX * zoom);

        const sheetNode = (
          <div
            className={`photo-print-sheet bg-white relative ${
              isPrintMode ? '' : 'shadow-lg ring-1 ring-slate-300'
            }`}
            style={{
              width: `${metrics.pageWidthMm}mm`,
              height: `${metrics.pageHeightMm}mm`,
              paddingTop: `${metrics.margins.top}mm`,
              paddingRight: `${metrics.margins.right}mm`,
              paddingBottom: `${metrics.margins.bottom}mm`,
              paddingLeft: `${metrics.margins.left}mm`,
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              breakAfter: isLastPage ? 'auto' : 'page',
            }}
          >
            {/* Screen-only Margin Box Outline */}
            <div
              className="no-print absolute pointer-events-none border border-dashed border-sky-300/80"
              style={{
                top: `${metrics.margins.top}mm`,
                right: `${metrics.margins.right}mm`,
                bottom: `${metrics.margins.bottom}mm`,
                left: `${metrics.margins.left}mm`,
              }}
            />

            {/* Screen-only page tag */}
            <div className="no-print absolute top-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 z-10">
              แผ่นที่ {pageIdx + 1}/{pages.length} •{' '}
              {layout === 'vertical' ? '1 แถวแนวตั้ง' : '1 แถวนอน'} (
              {paperOrientation === 'portrait' ? 'A4 แนวตั้ง' : 'A4 แนวนอน'})
            </div>

            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: layout === 'vertical' ? 'column' : 'row',
                alignItems,
                justifyContent,
                gap: `${metrics.safeGap}mm`,
                position: 'relative',
              }}
            >
              {pageAssets.map((asset) => {
                const imgSrc =
                  asset.dataUrl ||
                  asset.storageUrl ||
                  storageService.resolveImageSrc(`firestore-asset://${asset.id}`, asset.id);
                const displayName = stripExtension
                  ? asset.fileName.replace(/\.[^.]+$/, '')
                  : asset.fileName;
                const guardianName = showGuardianName
                  ? resolveLinkedGuardianLabel(asset, guardians)
                  : '';

                return (
                  <div
                    key={asset.id}
                    style={{
                      width: '30mm',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      breakInside: 'avoid',
                    }}
                  >
                    {/* Exact 30mm x 40mm Photo Box */}
                    <div
                      style={{
                        width: '30mm',
                        height: '40mm',
                        border: showCutLines ? '0.3mm dashed #94a3b8' : '0.2mm solid #e2e8f0',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={displayName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: fitMode,
                            display: 'block',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: '7pt',
                            color: '#94a3b8',
                            textAlign: 'center',
                          }}
                        >
                          ไม่มีรูปภาพ
                        </span>
                      )}
                    </div>

                    {/* Image Name directly below the 30x40mm frame */}
                    <div
                      style={{
                        width: '30mm',
                        marginTop: '1mm',
                        textAlign: 'center',
                        fontSize: '7.5pt',
                        lineHeight: 1.2,
                        fontWeight: 600,
                        color: '#0f172a',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {displayName}
                    </div>
                    {guardianName && (
                      <div
                        style={{
                          width: '30mm',
                          marginTop: '0.4mm',
                          textAlign: 'center',
                          fontSize: '6.5pt',
                          lineHeight: 1.15,
                          color: '#475569',
                          wordBreak: 'break-word',
                        }}
                      >
                        {guardianName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

        if (isPrintMode) {
          return <React.Fragment key={`page_${pageIdx}`}>{sheetNode}</React.Fragment>;
        }

        return (
          <div
            key={`page_${pageIdx}`}
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
                width: `${metrics.pageWidthMm}mm`,
                height: `${metrics.pageHeightMm}mm`,
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
