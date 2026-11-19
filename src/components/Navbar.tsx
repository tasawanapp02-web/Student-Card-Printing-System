import React, { useState, useRef, useEffect } from 'react';
import { UserAccount } from '../types';
import { storageService } from '../utils/storage';
import {
  CreditCard,
  Users,
  Sliders,
  Printer,
  History,
  Settings,
  LogOut,
  Globe,
  ChevronDown,
  FlipHorizontal2,
  Layers,
  Check,
  Palette,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

export type MainTabType =
  | 'cards'
  | 'cardRegistry'
  | 'students'
  | 'designer'
  | 'templates'
  | 'pvcPrint'
  | 'pvcPrintBack'
  | 'photoPrint'
  | 'history';

interface NavbarProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenExportModal: () => void;
}

type DropdownGroupId = 'print' | 'data' | 'design' | 'settings';

interface DropdownNavItem {
  id: MainTabType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DropdownNavGroup {
  id: Exclude<DropdownGroupId, 'settings'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: DropdownNavItem[];
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  onOpenSettings,
  onOpenExportModal,
}) => {
  const [academicYear, setAcademicYear] = useState<number>(() =>
    storageService.getAcademicYear()
  );
  const [openDropdown, setOpenDropdown] = useState<DropdownGroupId | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return storageService.subscribe(() => {
      setAcademicYear(storageService.getAcademicYear());
    });
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const navGroups: DropdownNavGroup[] = [
    {
      id: 'print',
      label: 'พิมพ์บัตร PVC',
      icon: Printer,
      items: [
        {
          id: 'pvcPrint',
          label: 'พิมพ์หน้าบัตรลงถาด PVC',
          description: 'จัดวางและพิมพ์หน้าบัตร 2 ใบต่อถาด',
          icon: Printer,
        },
        {
          id: 'pvcPrintBack',
          label: 'พิมพ์หลังบัตรลงถาด PVC',
          description: 'พิมพ์ด้านหลังบัตรพร้อมระบบหมุนถาด 180°',
          icon: FlipHorizontal2,
        },
        {
          id: 'photoPrint',
          label: 'พิมพ์รูปผู้ปกครอง',
          description: 'พิมพ์รูปขนาด 30×40 มม. และจัดการพื้นที่รูป',
          icon: ImageIcon,
        },
        {
          id: 'history',
          label: 'ประวัติและพิมพ์ซ้ำ',
          description: 'ดูประวัติการพิมพ์และสั่งพิมพ์ซ้ำ',
          icon: History,
        },
      ],
    },
    {
      id: 'data',
      label: 'ทะเบียนนักเรียนและบัตร',
      icon: Users,
      items: [
        {
          id: 'cards',
          label: 'บัตรรับส่งและผู้ปกครอง',
          description: 'จัดการผู้ปกครอง รูปถ่าย และออกบัตร',
          icon: CreditCard,
        },
        {
          id: 'cardRegistry',
          label: 'ทะเบียนบัตรผู้ปกครอง',
          description: 'ค้นหานักเรียน ดูบัตรเรียงความสัมพันธ์ และพิมพ์ A4',
          icon: FileText,
        },
        {
          id: 'students',
          label: 'ข้อมูลนักเรียน',
          description: 'รายชื่อนักเรียน ระดับชั้น และห้องเรียน',
          icon: Users,
        },
      ],
    },
    {
      id: 'design',
      label: 'ออกแบบและแม่แบบบัตร',
      icon: Palette,
      items: [
        {
          id: 'designer',
          label: 'ออกแบบบัตร (Card Designer)',
          description: 'ปรับตำแหน่งข้อความ รูปถ่าย และสีบัตร',
          icon: Sliders,
        },
        {
          id: 'templates',
          label: 'จัดการแม่แบบหน้า-หลังบัตร',
          description: 'แก้ไข ลบ ทำสำเนา และตั้งแม่แบบหลัก',
          icon: Layers,
        },
      ],
    },
  ];

  const activeTabLabelMap: Record<MainTabType, string> = {
    pvcPrint: 'พิมพ์หน้าบัตรลงถาด PVC',
    pvcPrintBack: 'พิมพ์หลังบัตรลงถาด PVC',
    photoPrint: 'พิมพ์รูปผู้ปกครอง',
    history: 'ประวัติและพิมพ์ซ้ำ',
    cards: 'บัตรรับส่งและผู้ปกครอง',
    cardRegistry: 'ทะเบียนบัตรผู้ปกครอง',
    students: 'ข้อมูลนักเรียน',
    designer: 'ออกแบบบัตร (Card Designer)',
    templates: 'จัดการแม่แบบหน้า-หลังบัตร',
  };

  const toggleDropdown = (id: DropdownGroupId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const handleSelectTab = (tab: MainTabType) => {
    setOpenDropdown(null);
    onTabChange(tab);
  };

  return (
    <header className="no-print bg-white sticky top-0 z-40 border-b border-slate-200 shadow-xs">
      {/* Row 1: Brand Logo & Title on Left, Academic Year, Export, User Profile on Right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Brand Icon + Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
              <svg viewBox="0 0 100 100" className="w-6 h-6 fill-current">
                <rect width="100" height="100" rx="22" fill="#2563eb" />
                <rect x="15" y="18" width="70" height="64" rx="8" fill="#ffffff" />
                <circle cx="36" cy="42" r="14" fill="#3b82f6" />
                <path d="M22 66c0-7.7 6.3-14 14-14s14 6.3 14 14z" fill="#3b82f6" />
                <rect x="56" y="32" width="22" height="6" rx="3" fill="#0f172a" />
                <rect x="56" y="44" width="18" height="4" rx="2" fill="#64748b" />
                <rect x="56" y="52" width="20" height="4" rx="2" fill="#64748b" />
                <rect x="22" y="72" width="56" height="4" rx="2" fill="#10b981" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 leading-tight">
                ระบบพิมพ์บัตรรับส่งนักเรียน
              </div>
              <div className="text-xs text-slate-500 font-sarabun">
                Student Pickup Card Management & PVC Printing System
              </div>
            </div>
          </div>

          {/* Right: Academic Year, Export, User Profile & Logout */}
          <div className="flex items-center gap-2.5">
            {/* Academic Year Badge */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 cursor-pointer transition-colors"
              onClick={onOpenSettings}
              title="คลิกเพื่อแก้ไขปีการศึกษาปัจจุบัน"
            >
              <span className="text-[11px] text-slate-500 font-sarabun">ปีการศึกษา:</span>
              <strong className="text-blue-700 font-mono font-bold">พ.ศ. {academicYear}</strong>
            </div>

            {/* GitHub Pages Deploy Helper */}
            <button
              type="button"
              onClick={onOpenExportModal}
              className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors"
              title="ส่งออกไฟล์ index.html สำหรับ GitHub Pages"
            >
              <Globe className="w-4 h-4" />
            </button>

            {/* User Profile & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {currentUser.photoURL && (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.fullName}
                    className="w-7 h-7 rounded-full border border-slate-200 object-cover hidden sm:block"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[160px]">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[160px]">
                    {currentUser.email || currentUser.position || 'ผู้ดูแลระบบ'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Dropdown Menu Navigation Bar */}
      <div className="border-t border-slate-100 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={navContainerRef}
            className="flex items-center justify-between gap-3 py-2 flex-wrap"
          >
            <nav className="flex items-center gap-2 flex-wrap">
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const activeItem = group.items.find((item) => item.id === activeTab);
                const isGroupActive = Boolean(activeItem);
                const isOpen = openDropdown === group.id;

                return (
                  <div key={group.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleDropdown(group.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                        isGroupActive
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : isOpen
                          ? 'bg-slate-100 text-blue-700 border border-blue-300 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      <GroupIcon
                        className={`w-4 h-4 ${isGroupActive ? 'text-white' : 'text-blue-600'}`}
                      />
                      <span>
                        {activeItem ? `${group.label}: ${activeItem.label}` : group.label}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        {group.items.map((item, idx) => {
                          const ItemIcon = item.icon;
                          const isSelected = activeTab === item.id;
                          return (
                            <React.Fragment key={item.id}>
                              {idx > 0 && <div className="my-1 border-t border-slate-100" />}
                              <button
                                type="button"
                                onClick={() => handleSelectTab(item.id)}
                                className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-blue-50/90' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-blue-50 text-blue-600'
                                  }`}
                                >
                                  <ItemIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between gap-2">
                                    <span className="truncate">{item.label}</span>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-sarabun mt-0.5">
                                    {item.description}
                                  </div>
                                </div>
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ตั้งค่า (Dropdown containing System Settings) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('settings')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    openDropdown === 'settings'
                      ? 'bg-slate-100 text-blue-700 border border-blue-300 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span>ตั้งค่า</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openDropdown === 'settings' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'settings' && (
                  <div className="absolute right-0 sm:left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {/* System Settings */}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(null);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          ตั้งค่าระบบและฐานข้อมูล
                        </div>
                        <div className="text-[11px] text-slate-400 font-sarabun mt-0.5">
                          ปีการศึกษา, Firebase, รีเซ็ตข้อมูล
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Current Page Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 font-sarabun">
              <span>หน้าปัจจุบัน:</span>
              <span className="font-semibold text-slate-700">
                {activeTabLabelMap[activeTab]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
