import React, { useState, useEffect } from 'react';
import {
  PrintPreviewPayload,
  PrintHistoryItem,
  Student,
  Guardian,
  PickupCard,
  ImageAsset,
} from '../types';
import { storageService } from '../utils/storage';
import { formatStudentGradeRoom, formatThaiDateTime } from '../utils/thaiDate';
import { sortCardsByGuardianRelation } from '../utils/relations';
import { CardPreview } from './CardPreview';
import { BackCardPreview } from './BackCardPreview';
import { PhotoPrintSheet } from './PhotoPrintSheet';
import { RegistryPrintSheet } from './RegistryPrintSheet';
import {
  Printer,
  X,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  Eye,
  Crosshair,
  AlertCircle,
  Info,
  RotateCw,
} from 'lucide-react';

export const PrintPreviewTab: React.FC = () => {
  const [payload] = useState<PrintPreviewPayload | null>(() =>
    storageService.getPrintPreviewPayload()
  );
  const [zoom, setZoom] = useState<number>(1.0);
  const [showScreenGuides, setShowScreenGuides] = useState<boolean>(true);
  const [printCrosshair, setPrintCrosshair] = useState<boolean>(false);
  const [hasLoggedPrint, setHasLoggedPrint] = useState<boolean>(false);
  const [rotateTray180, setRotateTray180] = useState<boolean>(() =>
    Boolean(payload?.trayConfig?.rotate180)
  );

  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [guardians, setGuardians] = useState<Guardian[]>(() => storageService.getGuardians());
  const [cards, setCards] = useState<PickupCard[]>(() => storageService.getCards());
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>(() => storageService.getImageAssets());

  useEffect(() => {
    return storageService.subscribe(() => {
      setStudents(storageService.getStudents());
      setGuardians(storageService.getGuardians());
      setCards(storageService.getCards());
      setImageAssets(storageService.getImageAssets());
    });
  }, []);

  if (!payload) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-prompt">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">
            ไม่พบข้อมูลสำหรับแสดงตัวอย่างการพิมพ์
          </h1>
          <p className="text-xs text-slate-500 font-sarabun leading-relaxed">
            กรุณากลับไปที่หน้าเมนูพิมพ์ลงถาด PVC หรือพิมพ์หลังบัตร แล้วกดปุ่มสั่งพิมพ์ใหม่อีกครั้ง
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
          >
            ปิดแท็บนี้
          </button>
        </div>
      </div>
    );
  }

  if (payload.side === 'photo' && payload.photoPrintConfig) {
    const photoCfg = payload.photoPrintConfig;
    const assetMap = new Map(imageAssets.map((a) => [a.id, a]));
    const selectedAssets = photoCfg.assetIds
      .map((id) => assetMap.get(id))
      .filter((a): a is ImageAsset => Boolean(a));
    const pageW = photoCfg.paperOrientation === 'portrait' ? 210 : 297;
    const pageH = photoCfg.paperOrientation === 'portrait' ? 297 : 210;

    return (
      <div className="min-h-screen bg-slate-200/80 flex flex-col font-prompt">
        <style>{`
          @media print {
            @page {
              size: ${pageW}mm ${pageH}mm;
              margin: 0mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .photo-print-stage {
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              display: block !important;
            }
            .photo-print-sheet {
              box-shadow: none !important;
              margin: 0 !important;
            }
          }
        `}</style>

        <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs bg-emerald-600">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900">
                  หน้าตัวอย่างการพิมพ์รูปผู้ปกครอง (30 × 40 มม. พร้อมชื่อรูป)
                </h1>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  รูปแบบ: {photoCfg.layout === 'vertical' ? '1 แถวแนวตั้ง' : '1 แถวนอน'} • กระดาษ A4{' '}
                  {photoCfg.paperOrientation === 'portrait' ? 'แนวตั้ง (210×297 มม.)' : 'แนวนอน (297×210 มม.)'} •{' '}
                  {selectedAssets.length} รูป
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="ย่อหน้าจอ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-700 min-w-[46px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="ขยายหน้าจอ"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                disabled={selectedAssets.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                สั่งพิมพ์ออกเครื่องพิมพ์ (Print)
              </button>

              <button
                type="button"
                onClick={() => window.close()}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                ปิดแท็บ
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-1.5">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-[11px] text-slate-600 font-sarabun text-center flex-wrap">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                คำแนะนำหน้าต่างพิมพ์: เลือกกระดาษ <strong>A4</strong> (
                {photoCfg.paperOrientation === 'portrait' ? 'แนวตั้ง Portrait' : 'แนวนอน Landscape'}) • ขอบกระดาษ (Margins) ={' '}
                <strong>None</strong> • มาตราส่วน (Scale) = <strong>100%</strong> เพื่อขนาดรูปจริง 30 × 40 มม.
              </span>
            </div>
          </div>
        </header>

        <main className="photo-print-stage flex-1 flex flex-col items-center p-6 sm:p-10 overflow-auto">
          {selectedAssets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 max-w-md">
              ไม่พบรูปภาพที่เลือกไว้ กรุณากลับไปเลือกรูปผู้ปกครองแล้วสั่งพิมพ์ใหม่อีกครั้ง
            </div>
          ) : (
            <>
              <div className="no-print">
                <PhotoPrintSheet
                  assets={selectedAssets}
                  layout={photoCfg.layout}
                  paperOrientation={photoCfg.paperOrientation}
                  gapMm={photoCfg.gapMm}
                  horizontalAlign={photoCfg.horizontalAlign}
                  verticalAlign={photoCfg.verticalAlign}
                  marginsMm={photoCfg.marginsMm}
                  showCutLines={photoCfg.showCutLines}
                  stripExtension={photoCfg.stripExtension}
                  showGuardianName={photoCfg.showGuardianName}
                  fitMode={photoCfg.fitMode}
                  guardians={guardians}
                  zoom={zoom}
                  isPrintMode={false}
                />
              </div>
              <div className="hidden print:block">
                <PhotoPrintSheet
                  assets={selectedAssets}
                  layout={photoCfg.layout}
                  paperOrientation={photoCfg.paperOrientation}
                  gapMm={photoCfg.gapMm}
                  horizontalAlign={photoCfg.horizontalAlign}
                  verticalAlign={photoCfg.verticalAlign}
                  marginsMm={photoCfg.marginsMm}
                  showCutLines={photoCfg.showCutLines}
                  stripExtension={photoCfg.stripExtension}
                  showGuardianName={photoCfg.showGuardianName}
                  fitMode={photoCfg.fitMode}
                  guardians={guardians}
                  zoom={1}
                  isPrintMode={true}
                />
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  if (payload.side === 'registry' && payload.registryPrintConfig) {
    const regCfg = payload.registryPrintConfig;
    const student = students.find((s) => s.studentId === regCfg.studentId);
    const guardianMap = new Map(guardians.map((g) => [g.id, g]));
    const studentCards = student
      ? sortCardsByGuardianRelation(
          cards.filter((c) => c.studentId === student.studentId),
          guardianMap
        )
      : [];
    const frontDesign =
      storageService.getFrontDesignById(regCfg.frontDesignId) ||
      storageService.getCardDesign(student?.level || 'มัธยมศึกษาตอนต้น');
    const academicYear = storageService.getAcademicYear();
    const pageW = regCfg.paperOrientation === 'portrait' ? 210 : 297;
    const pageH = regCfg.paperOrientation === 'portrait' ? 297 : 210;

    return (
      <div className="min-h-screen bg-slate-200/80 flex flex-col font-prompt">
        <style>{`
          @media print {
            @page {
              size: ${pageW}mm ${pageH}mm;
              margin: 0mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .registry-print-stage {
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              display: block !important;
            }
            .registry-print-sheet {
              box-shadow: none !important;
              margin: 0 !important;
            }
          }
        `}</style>

        <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs bg-blue-600">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900">
                  หน้าตัวอย่างก่อนพิมพ์ทะเบียนบัตรผู้ปกครอง (A4)
                </h1>
                <p className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                  {student
                    ? `${student.studentId} ${student.prefix}${student.firstName} ${student.lastName}`
                    : 'ไม่พบข้อมูลนักเรียน'}{' '}
                  • {regCfg.paperOrientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'} •{' '}
                  {regCfg.columnsPerRow} คอลัมน์
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                  title="ย่อหน้าจอ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-700 min-w-[46px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                  title="ขยายหน้าจอ"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                disabled={!student}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                สั่งพิมพ์ออกเครื่องพิมพ์ (Print)
              </button>

              <button
                type="button"
                onClick={() => window.close()}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                ปิดแท็บ
              </button>
            </div>
          </div>
        </header>

        <main className="registry-print-stage flex-1 flex flex-col items-center p-6 sm:p-10 overflow-auto">
          {!student ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 max-w-md">
              ไม่พบข้อมูลนักเรียนสำหรับพิมพ์ทะเบียนบัตรผู้ปกครอง
            </div>
          ) : (
            <>
              <div className="no-print">
                <RegistryPrintSheet
                  student={student}
                  cards={studentCards}
                  guardianMap={guardianMap}
                  frontDesign={frontDesign}
                  currentAcademicYear={academicYear}
                  paperOrientation={regCfg.paperOrientation}
                  columnsPerRow={regCfg.columnsPerRow}
                  repeatHeader={regCfg.repeatHeader}
                  showPageNumbers={regCfg.showPageNumbers}
                  headerTitle={regCfg.headerTitle}
                  headerSubtitle={regCfg.headerSubtitle}
                  reportDate={regCfg.reportDate}
                  zoom={zoom}
                  isPrintMode={false}
                />
              </div>
              <div className="hidden print:block">
                <RegistryPrintSheet
                  student={student}
                  cards={studentCards}
                  guardianMap={guardianMap}
                  frontDesign={frontDesign}
                  currentAcademicYear={academicYear}
                  paperOrientation={regCfg.paperOrientation}
                  columnsPerRow={regCfg.columnsPerRow}
                  repeatHeader={regCfg.repeatHeader}
                  showPageNumbers={regCfg.showPageNumbers}
                  headerTitle={regCfg.headerTitle}
                  headerSubtitle={regCfg.headerSubtitle}
                  reportDate={regCfg.reportDate}
                  zoom={1}
                  isPrintMode={true}
                />
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  const { trayConfig, side, enableSlot1, enableSlot2 } = payload;

  const guide1Left = rotateTray180
    ? Number((trayConfig.trayWidthMm - trayConfig.card1X - trayConfig.cardWidthMm).toFixed(2))
    : trayConfig.card1X;
  const guide1Top = rotateTray180
    ? Number((trayConfig.trayHeightMm - trayConfig.card1Y - trayConfig.cardHeightMm).toFixed(2))
    : trayConfig.card1Y;
  const guide2Left = rotateTray180
    ? Number((trayConfig.trayWidthMm - trayConfig.card2X - trayConfig.cardWidthMm).toFixed(2))
    : trayConfig.card2X;
  const guide2Top = rotateTray180
    ? Number((trayConfig.trayHeightMm - trayConfig.card2Y - trayConfig.cardHeightMm).toFixed(2))
    : trayConfig.card2Y;

  // Front card data
  const card1 = payload.slot1CardId ? cards.find((c) => c.id === payload.slot1CardId) : undefined;
  const student1 = card1 ? students.find((s) => s.studentId === card1.studentId) : undefined;
  const guardian1 = card1 ? guardians.find((g) => g.id === card1.guardianId) : undefined;
  const design1 =
    storageService.getFrontDesignById(payload.slot1DesignId) ||
    storageService.getCardDesign(student1?.level || 'มัธยมศึกษาตอนต้น');

  const card2 = payload.slot2CardId ? cards.find((c) => c.id === payload.slot2CardId) : undefined;
  const student2 = card2 ? students.find((s) => s.studentId === card2.studentId) : undefined;
  const guardian2 = card2 ? guardians.find((g) => g.id === card2.guardianId) : undefined;
  const design2 =
    storageService.getFrontDesignById(payload.slot2DesignId) ||
    storageService.getCardDesign(student2?.level || 'มัธยมศึกษาตอนต้น');

  // Back card designs (supports per-slot or shared)
  const fallbackBackDesign = payload.backDesign || storageService.getBackCardDesign();
  const backDesign1 =
    storageService.getBackDesignById(payload.slot1BackDesignId) || fallbackBackDesign;
  const backDesign2 =
    storageService.getBackDesignById(payload.slot2BackDesignId) || fallbackBackDesign;

  const recordPrintHistoryIfNeeded = () => {
    if (hasLoggedPrint) return;
    const now = new Date();
    const thaiDateTime = formatThaiDateTime(now);
    const operator = payload.operatorName || 'เจ้าหน้าที่ผู้พิมพ์';

    if (side === 'front') {
      let currentCards = storageService.getCards();
      let updated = false;

      if (enableSlot1 && card1 && student1 && guardian1) {
        const isReprint = card1.printCount > 0;
        const historyItem: PrintHistoryItem = {
          id: `hist_${Date.now()}_1`,
          timestamp: now.toISOString(),
          thaiDateString: thaiDateTime,
          studentId: student1.studentId,
          studentName: `${student1.prefix}${student1.firstName} ${student1.lastName}`,
          guardianName: `${guardian1.prefix}${guardian1.firstName} ${guardian1.lastName}`,
          level: student1.level,
          classroom: formatStudentGradeRoom(student1, storageService.getAcademicYear()),
          slotNumber: 1,
          printType: isReprint ? 'พิมพ์ซ้ำ (Reprint)' : 'บัตรใหม่',
          printSide: 'หน้าบัตร',
          operatorName: operator,
          cardId: card1.id,
        };
        storageService.addPrintHistoryItem(historyItem);
        currentCards = currentCards.map((c) =>
          c.id === card1.id
            ? { ...c, printCount: c.printCount + 1, lastPrintedAt: now.toISOString() }
            : c
        );
        updated = true;
      }

      if (enableSlot2 && card2 && student2 && guardian2) {
        const isReprint = card2.printCount > 0;
        const historyItem: PrintHistoryItem = {
          id: `hist_${Date.now()}_2`,
          timestamp: now.toISOString(),
          thaiDateString: thaiDateTime,
          studentId: student2.studentId,
          studentName: `${student2.prefix}${student2.firstName} ${student2.lastName}`,
          guardianName: `${guardian2.prefix}${guardian2.firstName} ${guardian2.lastName}`,
          level: student2.level,
          classroom: formatStudentGradeRoom(student2, storageService.getAcademicYear()),
          slotNumber: 2,
          printType: isReprint ? 'พิมพ์ซ้ำ (Reprint)' : 'บัตรใหม่',
          printSide: 'หน้าบัตร',
          operatorName: operator,
          cardId: card2.id,
        };
        storageService.addPrintHistoryItem(historyItem);
        currentCards = currentCards.map((c) =>
          c.id === card2.id
            ? { ...c, printCount: c.printCount + 1, lastPrintedAt: now.toISOString() }
            : c
        );
        updated = true;
      }

      if (updated) {
        storageService.saveCards(currentCards);
      }
    } else {
      // Back side print log
      const getBackLabel = (bd: typeof backDesign1) =>
        bd.displayMode === 'imageOnly'
          ? `พิมพ์หลังบัตร (${bd.name || 'ภาพพื้นหลังเต็มใบ'})`
          : `พิมพ์หลังบัตร: ${bd.name || bd.title}`;

      if (enableSlot1) {
        storageService.addPrintHistoryItem({
          id: `hist_${Date.now()}_back_1`,
          timestamp: now.toISOString(),
          thaiDateString: thaiDateTime,
          studentId: '-',
          studentName: 'พิมพ์ด้านหลังบัตร PVC',
          guardianName: getBackLabel(backDesign1),
          level: 'มัธยมศึกษาตอนต้น',
          classroom: '-',
          slotNumber: 1,
          printType: 'บัตรใหม่',
          printSide: 'หลังบัตร',
          operatorName: operator,
          cardId: 'back_card_template',
        });
      }

      if (enableSlot2) {
        storageService.addPrintHistoryItem({
          id: `hist_${Date.now()}_back_2`,
          timestamp: now.toISOString(),
          thaiDateString: thaiDateTime,
          studentId: '-',
          studentName: 'พิมพ์ด้านหลังบัตร PVC',
          guardianName: getBackLabel(backDesign2),
          level: 'มัธยมศึกษาตอนต้น',
          classroom: '-',
          slotNumber: 2,
          printType: 'บัตรใหม่',
          printSide: 'หลังบัตร',
          operatorName: operator,
          cardId: 'back_card_template',
        });
      }
    }

    setHasLoggedPrint(true);
  };

  const handlePrintNow = () => {
    recordPrintHistoryIfNeeded();
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-200/80 flex flex-col font-prompt">
      {/* Dynamic Print CSS matching exact PVC tray size */}
      <style>{`
        @media screen {
          .pvc-preview-sheet-zoom {
            transform: scale(${zoom});
            transform-origin: top center;
          }
        }
        @media print {
          @page {
            size: ${trayConfig.trayWidthMm}mm ${trayConfig.trayHeightMm}mm;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: ${trayConfig.trayWidthMm}mm !important;
            height: ${trayConfig.trayHeightMm}mm !important;
          }
          .pvc-preview-stage {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            display: block !important;
            min-height: 0 !important;
          }
          .pvc-preview-sheet-zoom {
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Toolbar (Screen Only) */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                side === 'front' ? 'bg-blue-600' : 'bg-indigo-600'
              }`}
            >
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900">
                  หน้าตัวอย่างการพิมพ์ลงถาด PVC —{' '}
                  {side === 'front' ? 'ด้านหน้าบัตร (Front)' : 'ด้านหลังบัตร (Back)'}
                </h1>
                {hasLoggedPrint && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    บันทึกประวัติแล้ว
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                ขนาดถาด: {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} mm | บัตร:{' '}
                {trayConfig.cardWidthMm} × {trayConfig.cardHeightMm} mm | ช่อง 1: (
                {trayConfig.card1X}, {trayConfig.card1Y}) | ช่อง 2: ({trayConfig.card2X},{' '}
                {trayConfig.card2Y}) mm
                {rotateTray180 ? ' | หมุนถาด 180°' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Zoom Controls */}
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="ย่อหน้าจอ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-700 min-w-[46px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.25).toFixed(2))))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="ขยายหน้าจอ"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Guide Toggles */}
            <button
              type="button"
              onClick={() => setShowScreenGuides((v) => !v)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                showScreenGuides
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>เส้นกรอบถาด</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintCrosshair((v) => !v)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                printCrosshair
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="พิมพ์เส้นกากบาทศูนย์กลางบัตรเพื่อทดสอบความตรงของถาด"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>กากบาททดสอบ</span>
            </button>

            <button
              type="button"
              onClick={() => setRotateTray180((v) => !v)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                rotateTray180
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="หมุนทั้งถาดพิมพ์ 180 องศา สำหรับการป้อนถาดกลับด้าน"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{rotateTray180 ? 'หมุนถาด 180° (เปิด)' : 'หมุนถาด 180°'}</span>
            </button>

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handlePrintNow}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              สั่งพิมพ์ออกเครื่องพิมพ์ (Print)
            </button>

            {/* Close Tab */}
            <button
              type="button"
              onClick={() => window.close()}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              ปิดแท็บ
            </button>
          </div>
        </div>

        {/* Printer Settings Reminder Strip */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-1.5">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-[11px] text-slate-600 font-sarabun text-center flex-wrap">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              คำแนะนำหน้าต่างพิมพ์: เลือกกระดาษ <strong>CD/DVD</strong> หรือ{' '}
              <strong>
                User-Defined ({trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} mm)
              </strong>{' '}
              • ขอบกระดาษ (Margins) = <strong>None</strong> • มาตราส่วน (Scale) ={' '}
              <strong>100%</strong> • เปิด <strong>Background Graphics</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Print Stage */}
      <main className="pvc-preview-stage flex-1 flex justify-center items-start p-6 sm:p-10 overflow-auto">
        <div
          id="pvc-tray-print-sheet"
          className={`pvc-preview-sheet-zoom relative bg-white ${
            showScreenGuides
              ? 'shadow-2xl ring-1 ring-slate-300'
              : 'shadow-xl'
          }`}
          style={{
            width: `${trayConfig.trayWidthMm}mm`,
            height: `${trayConfig.trayHeightMm}mm`,
            position: 'relative',
            margin: 0,
            padding: 0,
            backgroundColor: '#ffffff',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Screen-only Tray Dimension & Slot Reference Overlay */}
          {showScreenGuides && (
            <div className="no-print absolute inset-0 pointer-events-none z-40">
              <div className="absolute inset-0 border border-dashed border-blue-400/50" />
              <div className="absolute top-1.5 left-2 text-[9px] font-mono text-slate-400 bg-white/80 px-1 rounded">
                TRAY: {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} mm (
                {side === 'front' ? 'FRONT' : 'BACK'}
                {rotateTray180 ? ' • หมุนถาด 180°' : ''})
              </div>
              <div
                className="absolute border border-dashed border-blue-500/60"
                style={{
                  left: `${guide1Left}mm`,
                  top: `${guide1Top}mm`,
                  width: `${trayConfig.cardWidthMm}mm`,
                  height: `${trayConfig.cardHeightMm}mm`,
                }}
              >
                <span className="absolute -top-4 left-0 text-[9px] font-mono text-blue-600 font-bold bg-white/90 px-1 rounded">
                  Slot 1 ({guide1Left}, {guide1Top})
                  {!enableSlot1 ? ' [ปิด]' : ''}
                </span>
              </div>
              <div
                className="absolute border border-dashed border-blue-500/60"
                style={{
                  left: `${guide2Left}mm`,
                  top: `${guide2Top}mm`,
                  width: `${trayConfig.cardWidthMm}mm`,
                  height: `${trayConfig.cardHeightMm}mm`,
                }}
              >
                <span className="absolute -top-4 left-0 text-[9px] font-mono text-blue-600 font-bold bg-white/90 px-1 rounded">
                  Slot 2 ({guide2Left}, {guide2Top})
                  {!enableSlot2 ? ' [ปิด]' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Rotatable Print Content Wrapper (rotates whole tray 180° around tray center) */}
          <div
            className="absolute inset-0"
            style={{
              transform: rotateTray180 ? 'rotate(180deg)' : undefined,
              transformOrigin: 'center center',
            }}
          >
            {/* Slot 1 Content */}
            {enableSlot1 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${trayConfig.card1X}mm`,
                  top: `${trayConfig.card1Y}mm`,
                  width: `${trayConfig.cardWidthMm}mm`,
                  height: `${trayConfig.cardHeightMm}mm`,
                }}
              >
                {side === 'front' && card1 ? (
                  <CardPreview
                    design={design1}
                    student={student1}
                    guardian={guardian1}
                    card={card1}
                    isPrintMode={true}
                    cardWidthMm={trayConfig.cardWidthMm}
                    cardHeightMm={trayConfig.cardHeightMm}
                  />
                ) : side === 'back' ? (
                  <BackCardPreview
                    design={backDesign1}
                    isPrintMode={true}
                    rotate180={Boolean(payload.backSlot1Rotate180)}
                    cardWidthMm={trayConfig.cardWidthMm}
                    cardHeightMm={trayConfig.cardHeightMm}
                  />
                ) : null}

                {printCrosshair && (
                  <div className="absolute inset-0 pointer-events-none z-50">
                    <div className="absolute top-1/2 left-0 right-0 h-[0.2mm] bg-red-500" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-[0.2mm] bg-red-500" />
                  </div>
                )}
              </div>
            )}

            {/* Slot 2 Content */}
            {enableSlot2 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${trayConfig.card2X}mm`,
                  top: `${trayConfig.card2Y}mm`,
                  width: `${trayConfig.cardWidthMm}mm`,
                  height: `${trayConfig.cardHeightMm}mm`,
                }}
              >
                {side === 'front' && card2 ? (
                  <CardPreview
                    design={design2}
                    student={student2}
                    guardian={guardian2}
                    card={card2}
                    isPrintMode={true}
                    cardWidthMm={trayConfig.cardWidthMm}
                    cardHeightMm={trayConfig.cardHeightMm}
                  />
                ) : side === 'back' ? (
                  <BackCardPreview
                    design={backDesign2}
                    isPrintMode={true}
                    rotate180={Boolean(payload.backSlot2Rotate180)}
                    cardWidthMm={trayConfig.cardWidthMm}
                    cardHeightMm={trayConfig.cardHeightMm}
                  />
                ) : null}

                {printCrosshair && (
                  <div className="absolute inset-0 pointer-events-none z-50">
                    <div className="absolute top-1/2 left-0 right-0 h-[0.2mm] bg-red-500" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-[0.2mm] bg-red-500" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
