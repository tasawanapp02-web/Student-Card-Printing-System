import React, { useState, useEffect } from 'react';
import { PrintHistoryItem } from '../types';
import { storageService } from '../utils/storage';
import { formatHistoryClassroom } from '../utils/thaiDate';
import {
  History,
  Search,
  RotateCcw,
  Printer,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface PrintHistoryViewProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onReprintCard: (cardId: string) => void;
}

export const PrintHistoryView: React.FC<PrintHistoryViewProps> = ({
  onNotify,
  onReprintCard,
}) => {
  const [history, setHistory] = useState<PrintHistoryItem[]>(() =>
    storageService.getPrintHistory()
  );

  useEffect(() => {
    return storageService.subscribe(() => {
      setHistory(storageService.getPrintHistory());
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'บัตรใหม่' | 'พิมพ์ซ้ำ (Reprint)'>('all');

  const filteredHistory = history.filter((item) => {
    const matchesType = typeFilter === 'all' || item.printType === typeFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.studentId.includes(q) ||
      item.studentName.toLowerCase().includes(q) ||
      item.guardianName.toLowerCase().includes(q) ||
      item.operatorName.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  const handleClearHistory = () => {
    if (confirm('คุณต้องการล้างประวัติการพิมพ์บัตรทั้งหมดหรือไม่?')) {
      setHistory([]);
      storageService.savePrintHistory([]);
      onNotify('ล้างประวัติการพิมพ์เรียบร้อยแล้ว', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            ประวัติการสั่งพิมพ์บัตรและการพิมพ์ซ้ำ (Print History & Reprint)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            บันทึกประวัติการพิมพ์ทุกครั้ง ค้นหาจากรหัส 5 หลัก ชื่อนร. หรือผู้ปกครอง และกดพิมพ์ซ้ำ (Reprint) ลงถาด EPSON ได้ทันที
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ล้างประวัติ
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาจากรหัส 5 หลัก, ชื่อนร., หรือชื่อผู้ปกครอง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sarabun"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="inline-flex text-xs bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                typeFilter === 'all' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              ทั้งหมด ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('บัตรใหม่')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                typeFilter === 'บัตรใหม่' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              บัตรใหม่
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('พิมพ์ซ้ำ (Reprint)')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                typeFilter === 'พิมพ์ซ้ำ (Reprint)'
                  ? 'bg-white text-amber-700 shadow-xs font-bold'
                  : 'text-slate-600'
              }`}
            >
              พิมพ์ซ้ำ (Reprint)
            </button>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 font-sarabun">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">วัน-เวลาที่สั่งพิมพ์ (พ.ศ.)</th>
                <th className="py-3 px-4">รหัส 5 หลัก</th>
                <th className="py-3 px-4">ชื่อนักเรียน</th>
                <th className="py-3 px-4">ชั้น/ห้อง</th>
                <th className="py-3 px-4">ชื่อผู้ปกครอง (ผู้ถือบัตร)</th>
                <th className="py-3 px-4">ช่องถาด</th>
                <th className="py-3 px-4">ประเภท</th>
                <th className="py-3 px-4">ผู้สั่งพิมพ์</th>
                <th className="py-3 px-4 text-center">พิมพ์ซ้ำ (Reprint)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.thaiDateString}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {item.studentId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {item.studentName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatHistoryClassroom(item.classroom)} ({item.level === 'มัธยมศึกษาตอนต้น' ? 'ม.ต้น' : 'ม.ปลาย'})
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.guardianName}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                        ช่องที่ {item.slotNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.printType === 'บัตรใหม่'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.printType}
                        </span>
                        {item.printSide && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.printSide === 'หลังบัตร'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {item.printSide}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {item.operatorName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onReprintCard(item.cardId)}
                        className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded-xl transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                        title="ดึงบัตรนี้กลับมาสั่งพิมพ์ซ้ำลงถาดพิมพ์"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        พิมพ์ซ้ำ (Reprint)
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    ไม่พบประวัติการพิมพ์ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
