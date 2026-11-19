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
      if (window.innerWidth < 1024) return;
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
          description: 'ค้นหา บัตรผู้ปกครอง',
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

  const mobileBottomLabels: Record<Exclude<DropdownGroupId, 'settings'>, string> = {
    print: 'พิมพ์บัตร',
    data: 'ทะเบียนบัตร',
    design: 'ออกแบบ',
  };

  const toggleDropdown = (id: DropdownGroupId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const handleSelectTab = (tab: MainTabType) => {
    setOpenDropdown(null);
    onTabChange(tab);
  };

  const activeGroupForMobileSheet =
    openDropdown && openDropdown !== 'settings'
      ? navGroups.find((g) => g.id === openDropdown) || null
      : null;

  return (
    <>
      <header className="no-print bg-white sticky top-0 z-40 border-b border-slate-200 shadow-xs">
        {/* Row 1: Brand Logo & Title on Left, Desktop Controls on Right */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-16 gap-3 lg:gap-4">
            {/* Left: Brand Icon + Title */}
            <div className="flex items-center gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs shrink-0">
                <svg viewBox="0 0 100 100" className="w-5 h-5 lg:w-6 lg:h-6 fill-current">
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
              <div className="min-w-0">
                <div className="text-sm lg:text-base font-bold text-slate-900 leading-tight truncate">
                  ระบบพิมพ์บัตรรับส่งนักเรียน
                </div>
                <div className="hidden lg:block text-xs text-slate-500 font-sarabun">
                  Student Pickup Card Management & PVC Printing System
                </div>
                <div className="lg:hidden text-[11px] text-blue-600 font-medium font-sarabun truncate">
                  {activeTabLabelMap[activeTab]}
                </div>
              </div>
            </div>

            {/* Right: Desktop Academic Year, Export, User Profile & Logout */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Academic Year Badge (Desktop only) */}
              <div
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 cursor-pointer transition-colors"
                onClick={onOpenSettings}
                title="คลิกเพื่อแก้ไขปีการศึกษาปัจจุบัน"
              >
                <span className="text-[11px] text-slate-500 font-sarabun">ปีการศึกษา:</span>
                <strong className="text-blue-700 font-mono font-bold">พ.ศ. {academicYear}</strong>
              </div>

              {/* GitHub Pages Deploy Helper (Desktop only) */}
              <button
                type="button"
                onClick={onOpenExportModal}
                className="hidden lg:inline-flex p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="ส่งออกไฟล์ index.html สำหรับ GitHub Pages"
              >
                <Globe className="w-4 h-4" />
              </button>

              {/* User Profile & Logout */}
              {currentUser && (
                <div className="flex items-center gap-2 lg:pl-2 lg:border-l lg:border-slate-200">
                  {currentUser.photoURL && (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.fullName}
                      className="w-7 h-7 rounded-full border border-slate-200 object-cover hidden lg:block"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="text-right hidden lg:block">
                    <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[160px]">
                      {currentUser.fullName}
                    </div>
                    {currentUser.position && currentUser.position !== currentUser.fullName && (
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[160px]">
                        {currentUser.position}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Desktop Dropdown Menu Navigation Bar (Desktop >= lg only) */}
        <div className="hidden lg:block border-t border-slate-100 bg-slate-50/70">
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

      {/* Non-Computer (< lg): Responsive Bottom Nav Hybrid + Slide-Up Action Sheet */}
      {openDropdown && (
        <div
          className="no-print lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setOpenDropdown(null)}
          aria-hidden="true"
        />
      )}

      {openDropdown && (
        <div
          role="dialog"
          aria-label="เมนูนำทางย่อย"
          className="no-print lg:hidden fixed bottom-16 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:bottom-20 sm:w-full sm:max-w-md z-50 bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-150"
        >
          {/* Mobile Drag Handle */}
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {activeGroupForMobileSheet ? (
                <>
                  <activeGroupForMobileSheet.icon className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {activeGroupForMobileSheet.label}
                  </span>
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-900 truncate">ตั้งค่าระบบ</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpenDropdown(null)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
              aria-label="ปิดเมนู"
            >
              ✕
            </button>
          </div>

          <div className="p-2.5 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {activeGroupForMobileSheet ? (
              activeGroupForMobileSheet.items.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full min-h-[52px] text-left px-3 py-2.5 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-500 font-sarabun truncate">
                        {item.description}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    onOpenSettings();
                  }}
                  className="w-full min-h-[52px] text-left px-3 py-2.5 rounded-2xl hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900">ตั้งค่าระบบและฐานข้อมูล</div>
                    <div className="text-[11px] text-slate-500 font-sarabun truncate">
                      Firebase, จัดการบัญชี และรีเซ็ตข้อมูล
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    onLogout();
                  }}
                  className="w-full min-h-[52px] text-left px-3 py-2.5 rounded-2xl hover:bg-rose-50 active:bg-rose-100 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-rose-700">ออกจากระบบ</div>
                    <div className="text-[11px] text-rose-500 font-sarabun">
                      ลงชื่อออกจากบัญชีปัจจุบัน
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (Mobile & Tablet < lg) */}
      <nav
        aria-label="เมนูหลักด้านล่าง"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
      >
        <div className="max-w-2xl mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 h-16 items-center">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = group.items.some((item) => item.id === activeTab);
              const isSheetOpen = openDropdown === group.id;
              const isHighlighted = isGroupActive || isSheetOpen;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleDropdown(group.id)}
                  aria-expanded={isSheetOpen}
                  className={`relative h-full min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 rounded-xl transition-colors cursor-pointer ${
                    isHighlighted
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800 active:bg-slate-100'
                  }`}
                >
                  {isGroupActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600"
                    />
                  )}
                  <GroupIcon className="w-5 h-5 shrink-0" />
                  <span
                    className={`text-[11px] sm:text-xs whitespace-nowrap leading-none ${
                      isHighlighted ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {mobileBottomLabels[group.id]}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => toggleDropdown('settings')}
              aria-expanded={openDropdown === 'settings'}
              className={`relative h-full min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 rounded-xl transition-colors cursor-pointer ${
                openDropdown === 'settings'
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-800 active:bg-slate-100'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span
                className={`text-[11px] sm:text-xs whitespace-nowrap leading-none ${
                  openDropdown === 'settings' ? 'font-bold' : 'font-medium'
                }`}
              >
                ตั้งค่า
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
