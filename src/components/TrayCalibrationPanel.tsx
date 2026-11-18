import React from 'react';
import { TrayCalibrationConfig } from '../types';
import {
  Settings2,
  LayoutTemplate,
  Ruler,
  Layers,
  SlidersHorizontal,
  RotateCw,
} from 'lucide-react';

interface TrayCalibrationPanelProps {
  trayConfig: TrayCalibrationConfig;
  onChange: (nextConfig: TrayCalibrationConfig) => void;
  showTestPattern: boolean;
  onToggleTestPattern: () => void;
  onSave: () => void;
  onReset: () => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const TrayCalibrationPanel: React.FC<TrayCalibrationPanelProps> = ({
  trayConfig,
  onChange,
  showTestPattern,
  onToggleTestPattern,
  onSave,
  onReset,
  onNotify,
}) => {
  const applyPreset = (preset: {
    name: string;
    trayWidthMm: number;
    trayHeightMm: number;
    card1X: number;
    card1Y: number;
    card2X: number;
    card2Y: number;
  }) => {
    onChange({
      ...trayConfig,
      printerProfile: preset.name,
      trayWidthMm: preset.trayWidthMm,
      trayHeightMm: preset.trayHeightMm,
      card1X: preset.card1X,
      card1Y: preset.card1Y,
      card2X: preset.card2X,
      card2Y: preset.card2Y,
    });
    onNotify(`เลือกรูปแบบถาด: ${preset.name}`, 'info');
  };

  return (
    <div className="no-print bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-200/60 gap-3">
        <div>
          <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-600" />
            ตั้งค่าขนาดถาดและพิกัดตำแหน่งพิมพ์ (ใช้ร่วมกันทั้งหน้าบัตรและหลังบัตร)
          </h3>
          <p className="text-xs text-blue-700 mt-0.5">
            กำหนดขนาดความกว้าง-ยาวของถาดพิมพ์ และปรับระยะพิกัด X/Y (หน่วยมิลลิเมตร mm) ละเอียด 0.1mm ค่าที่บันทึกจะใช้ร่วมกันทั้งเมนูพิมพ์หน้าบัตรและหลังบัตร
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const next = !trayConfig.rotate180;
              onChange({ ...trayConfig, rotate180: next });
              onNotify(
                next ? 'หมุนถาดพิมพ์บัตร 180° แล้ว' : 'ยกเลิกการหมุนถาด 180° (แนวปกติ)',
                'info'
              );
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
              trayConfig.rotate180
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{trayConfig.rotate180 ? 'หมุนถาด 180° (เปิดอยู่)' : 'หมุนถาด 180°'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleTestPattern}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showTestPattern
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'
            }`}
          >
            {showTestPattern ? 'ซ่อนเส้นกากบาทแนวพิมพ์' : 'แสดงเส้นกากบาทแนวพิมพ์'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            รีเซ็ตค่ามาตรฐาน
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-xs cursor-pointer"
          >
            บันทึกพิกัดและขนาดถาด
          </button>
        </div>
      </div>

      {/* Tray Model Quick Presets */}
      <div className="bg-white/80 p-3.5 rounded-xl border border-blue-200/80">
        <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
          เลือกขนาดถาดสำเร็จรูป (Tray Model Presets):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              applyPreset({
                name: 'EPSON L850 / L805 / R290 (130 × 220 mm)',
                trayWidthMm: 130.0,
                trayHeightMm: 220.0,
                card1X: 22.2,
                card1Y: 18.0,
                card2X: 22.2,
                card2Y: 122.0,
              })
            }
            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
              trayConfig.trayWidthMm === 130 && trayConfig.trayHeightMm === 220
                ? 'bg-blue-50 border-blue-400 font-bold text-blue-900 ring-2 ring-blue-300/60'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-xs font-bold">EPSON L850 / L805</div>
            <div className="text-[10px] text-slate-500 font-mono">130 × 220 mm (ค่าเริ่มต้น)</div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                name: 'Canon Pixma Tray J (130 × 253 mm)',
                trayWidthMm: 130.0,
                trayHeightMm: 253.0,
                card1X: 22.2,
                card1Y: 34.0,
                card2X: 22.2,
                card2Y: 148.0,
              })
            }
            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
              trayConfig.trayWidthMm === 130 && trayConfig.trayHeightMm === 253
                ? 'bg-blue-50 border-blue-400 font-bold text-blue-900 ring-2 ring-blue-300/60'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-xs font-bold">Canon Tray J</div>
            <div className="text-[10px] text-slate-500 font-mono">130 × 253 mm</div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                name: 'Canon Pixma Tray G / M (130 × 250 mm)',
                trayWidthMm: 130.0,
                trayHeightMm: 250.0,
                card1X: 22.2,
                card1Y: 32.0,
                card2X: 22.2,
                card2Y: 145.0,
              })
            }
            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
              trayConfig.trayWidthMm === 130 && trayConfig.trayHeightMm === 250
                ? 'bg-blue-50 border-blue-400 font-bold text-blue-900 ring-2 ring-blue-300/60'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-xs font-bold">Canon Tray G / M</div>
            <div className="text-[10px] text-slate-500 font-mono">130 × 250 mm</div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                name: 'ถาดคู่ขนาดใหญ่ A4 (210 × 297 mm)',
                trayWidthMm: 210.0,
                trayHeightMm: 297.0,
                card1X: 62.0,
                card1Y: 45.0,
                card2X: 62.0,
                card2Y: 165.0,
              })
            }
            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
              trayConfig.trayWidthMm === 210 && trayConfig.trayHeightMm === 297
                ? 'bg-blue-50 border-blue-400 font-bold text-blue-900 ring-2 ring-blue-300/60'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-xs font-bold">ถาดคู่ขนาด A4</div>
            <div className="text-[10px] text-slate-500 font-mono">210 × 297 mm</div>
          </button>
        </div>
      </div>

      {/* Section: Tray Dimensions & Card Dimensions Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-3">
          <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-blue-900">
              <Ruler className="w-4 h-4 text-blue-600" />
              ขนาดถาดพิมพ์ (Tray Size: กว้าง × ยาว)
            </span>
            <span className="text-[11px] text-blue-700 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {trayConfig.trayWidthMm} × {trayConfig.trayHeightMm} มม.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ความกว้างถาด (Tray Width)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="350"
                  value={trayConfig.trayWidthMm}
                  onChange={(e) =>
                    onChange({
                      ...trayConfig,
                      trayWidthMm: parseFloat(e.target.value) || 130,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-semibold text-xs">mm</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ความยาว/สูงถาด (Tray Height)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="500"
                  value={trayConfig.trayHeightMm}
                  onChange={(e) =>
                    onChange({
                      ...trayConfig,
                      trayHeightMm: parseFloat(e.target.value) || 220,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-semibold text-xs">mm</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-3">
          <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-blue-900">
              <Layers className="w-4 h-4 text-blue-600" />
              ขนาดบัตร PVC (CR80 Standard Card)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              CR80: 85.6 × 54.0 มม.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ความกว้างบัตร (Card Width)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="40"
                  max="150"
                  value={trayConfig.cardWidthMm}
                  onChange={(e) =>
                    onChange({
                      ...trayConfig,
                      cardWidthMm: parseFloat(e.target.value) || 85.6,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-semibold text-xs">mm</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ความสูงบัตร (Card Height)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="150"
                  value={trayConfig.cardHeightMm}
                  onChange={(e) =>
                    onChange({
                      ...trayConfig,
                      cardHeightMm: parseFloat(e.target.value) || 54.0,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-semibold text-xs">mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Card Slots Offset */}
      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-2.5">
        <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-blue-900">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            พิกัดตำแหน่งช่องบัตรบนถาด (Card Slot Position Coordinates):
          </span>
          <span className="text-[10px] text-slate-500">
            วัดจากขอบซ้าย (X) และขอบบน (Y) ของถาดพิมพ์จริง
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block font-semibold text-slate-700 text-[11px] mb-1">
              บัตรใบที่ 1: ขอบซ้าย (X)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="150"
                value={trayConfig.card1X}
                onChange={(e) =>
                  onChange({ ...trayConfig, card1X: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg bg-white font-bold"
              />
              <span className="text-slate-500 font-medium text-[11px]">mm</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block font-semibold text-slate-700 text-[11px] mb-1">
              บัตรใบที่ 1: ขอบบน (Y)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="300"
                value={trayConfig.card1Y}
                onChange={(e) =>
                  onChange({ ...trayConfig, card1Y: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg bg-white font-bold"
              />
              <span className="text-slate-500 font-medium text-[11px]">mm</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block font-semibold text-slate-700 text-[11px] mb-1">
              บัตรใบที่ 2: ขอบซ้าย (X)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="150"
                value={trayConfig.card2X}
                onChange={(e) =>
                  onChange({ ...trayConfig, card2X: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg bg-white font-bold"
              />
              <span className="text-slate-500 font-medium text-[11px]">mm</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block font-semibold text-slate-700 text-[11px] mb-1">
              บัตรใบที่ 2: ขอบบน (Y)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="350"
                value={trayConfig.card2Y}
                onChange={(e) =>
                  onChange({ ...trayConfig, card2Y: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg bg-white font-bold"
              />
              <span className="text-slate-500 font-medium text-[11px]">mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
