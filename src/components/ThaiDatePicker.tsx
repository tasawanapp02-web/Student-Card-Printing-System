import React, { useState, useRef, useEffect } from 'react';
import {
  THAI_MONTHS_FULL,
  formatThaiDateFull,
  formatThaiDateShort,
  parseDateToThaiComponents,
  constructDateFromThai,
  getCurrentBuddhistYear,
} from '../utils/thaiDate';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  quickPreset3YearsEntryYear?: number; // If provided, shows quick button "+3 ปีการศึกษา (30 เม.ย.)"
  disabled?: boolean;
}

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  onChange,
  label,
  quickPreset3YearsEntryYear,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialComponents = parseDateToThaiComponents(value);
  const [viewMonth, setViewMonth] = useState(initialComponents.month);
  const [viewYear, setViewYear] = useState(initialComponents.buddhistYear);

  useEffect(() => {
    const comp = parseDateToThaiComponents(value);
    setViewMonth(comp.month);
    setViewYear(comp.buddhistYear);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Days in selected month
  const ceYear = viewYear - 543;
  const daysInMonth = new Date(ceYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(ceYear, viewMonth, 1).getDay(); // 0 is Sun

  const currentSelection = parseDateToThaiComponents(value);

  const handleSelectDay = (day: number) => {
    const newDateStr = constructDateFromThai(day, viewMonth, viewYear);
    onChange(newDateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const setToday = () => {
    const now = new Date();
    const newDateStr = constructDateFromThai(
      now.getDate(),
      now.getMonth(),
      now.getFullYear() + 543
    );
    onChange(newDateStr);
    setIsOpen(false);
  };

  const setThreeYearsExpiry = () => {
    const baseYear = quickPreset3YearsEntryYear || getCurrentBuddhistYear();
    const expiryBYear = baseYear + 3;
    // 30 April (month index 3)
    const newDateStr = constructDateFromThai(30, 3, expiryBYear);
    onChange(newDateStr);
    setIsOpen(false);
  };

  // Year options: from 2560 to 2580
  const yearOptions: number[] = [];
  for (let y = 2560; y <= 2580; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Input button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg text-slate-800 transition-colors shadow-xs ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-sarabun font-medium">
            {value ? formatThaiDateFull(value) : 'เลือกวันที่ (พ.ศ.)'}
          </span>
        </span>
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-sarabun">
          พ.ศ. {currentSelection.buddhistYear}
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 right-0 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Month/Year Selector */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {THAI_MONTHS_FULL.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 mb-1">
            <span className="text-red-500">อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span className="text-blue-500">ส</span>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Blank leading slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="h-7" />
            ))}

            {/* Days in month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                currentSelection.day === day &&
                currentSelection.month === viewMonth &&
                currentSelection.buddhistYear === viewYear;

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto flex items-center justify-center rounded-lg text-xs font-sarabun transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'hover:bg-blue-50 text-slate-700 hover:text-blue-600'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick Presets */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={setToday}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={setThreeYearsExpiry}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[11px] font-medium border border-amber-200"
            >
              3 ปีการศึกษา (30 เม.ย.)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
