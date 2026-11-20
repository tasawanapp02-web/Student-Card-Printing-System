export type EducationLevel = 'มัธยมศึกษาตอนต้น' | 'มัธยมศึกษาตอนปลาย';

export type UserRole = 'admin';

export interface UserAccount {
  id: string;
  uid?: string;
  email?: string;
  photoURL?: string;
  authMethod?: 'google' | 'password';
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  position: string;
  createdAt: string;
  isActive: boolean;
}

export interface OperatorAccount {
  id: string;
  ownerId?: string;
  uid: string;
  username: string;
  email: string;
  fullName: string;
  position: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  studentId: string; // 5-digit primary key e.g. "50101"
  ownerId?: string;
  prefix: string; // เด็กชาย, เด็กหญิง, นาย, นางสาว
  firstName: string;
  lastName: string;
  nickname: string;
  level: EducationLevel;
  classroom: string; // e.g. "1", "2", "3" (shown as ม.1/2)
  entryYear: number; // ปี พ.ศ. ที่เข้ารับการศึกษา e.g. 2567, 2568, 2569
  createdAt: string;
  updatedAt: string;
}

export type ImageAssetCategory = 'front_bg' | 'back_bg' | 'guardian_photo' | 'sample_photo';

export interface ImageAsset {
  id: string;
  ownerId?: string;
  category: ImageAssetCategory;
  fileName: string;
  contentType: 'image/webp' | 'image/jpeg' | 'image/png' | 'image/svg+xml';
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  storageBackend: 'both' | 'storage' | 'firestore';
  storageUrl?: string;
  storagePath?: string;
  dataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  ownerId?: string;
  prefix: string; // นาย, นาง, นางสาว
  firstName: string;
  lastName: string;
  relation: string; // บิดา, มารดา, ผู้ปกครอง, ปู่/ย่า, ตา/ยาย, ญาติ
  phone: string;
  photoUrl: string; // Firebase Storage URL, firestore-asset:// ref, or fallback SVG
  photoFileName: string; // Original/stored filename for smart reference check
  photoStoragePath?: string; // Firebase Storage object path for cleanup
  photoAssetId?: string; // Firestore image_assets doc ID
  createdAt: string;
  updatedAt?: string;
}

export interface PickupCard {
  id: string;
  ownerId?: string;
  studentId: string; // 5-digit student ID
  guardianId: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  status: 'active' | 'expired' | 'revoked';
  qrCodeText: string;
  frontDesignId?: string; // Optional preferred front card template ID (empty for auto by level)
  createdAt: string;
  updatedAt?: string;
  printCount: number;
  lastPrintedAt: string | null;
}

export type CardDateFormat = 'short' | 'full' | 'numeric';
export type LabelLayoutMode = 'inline' | 'newline' | 'hidden';
export type ClassDisplayMode = 'short_m' | 'custom_prefix' | 'custom_text';

export interface CardElementStyle {
  x: number; // in mm or percentage/px
  y: number;
  fontSize: number; // in pt or px
  fontWeight: 'normal' | 'bold' | '600';
  fontFamily?: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  visible: boolean;
  lineHeight?: number;
  width?: number; // for photo or QR
  height?: number; // for photo or QR
  borderRadius?: number; // for photo
  borderColor?: string;
  borderWidth?: number;
  // Date formatting (issueDate / expiryDate)
  dateFormat?: CardDateFormat;
  // Prefix / Label options
  prefixText?: string;
  labelLayout?: LabelLayoutMode;
  showRelation?: boolean;
  // Student ID styling
  numbersOnly?: boolean;
  showBackground?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  // Student Class formatting
  classDisplayMode?: ClassDisplayMode;
  customText?: string;
}

export interface CardDesignConfig {
  id: string;
  ownerId?: string;
  name?: string; // Template name e.g. "แบบมาตรฐาน ม.ต้น"
  isDefault?: boolean; // Default template for its education level
  createdAt?: string;
  updatedAt?: string;
  level: EducationLevel;
  title: string;
  subtitle: string;
  bgImageUrl: string;
  bgImageStoragePath?: string;
  bgImageAssetId?: string;
  bgType: 'preset' | 'custom';
  bgLayerAbovePhoto?: boolean; // When true (default), PNG background image is rendered above guardian photo (guardian photo underneath)
  elements: {
    title: CardElementStyle;
    subtitle: CardElementStyle;
    guardianPhoto: CardElementStyle;
    guardianName: CardElementStyle;
    studentName: CardElementStyle;
    studentClass: CardElementStyle;
    studentId: CardElementStyle;
    issueDate: CardElementStyle;
    expiryDate: CardElementStyle;
    qrCode: CardElementStyle;
    schoolLogo: CardElementStyle;
  };
}

export interface TrayCalibrationConfig {
  // Dimensions for EPSON L850 / Stylus Photo R290 Series 2-card tray
  trayWidthMm: number; // typically 130mm
  trayHeightMm: number; // typically 220mm
  cardWidthMm: number; // 85.6mm (CR80)
  cardHeightMm: number; // 54.0mm (CR80)
  // Card 1 position
  card1X: number; // mm from left
  card1Y: number; // mm from top
  // Card 2 position
  card2X: number; // mm from left
  card2Y: number; // mm from top
  printerProfile: string;
  rotate180?: boolean; // Rotate entire tray 180 degrees
}

export interface PrintHistoryItem {
  id: string;
  ownerId?: string;
  timestamp: string; // ISO
  createdAt?: string;
  thaiDateString: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  level: EducationLevel;
  classroom: string;
  slotNumber: 1 | 2;
  printType: 'บัตรใหม่' | 'พิมพ์ซ้ำ (Reprint)';
  printSide?: 'หน้าบัตร' | 'หลังบัตร';
  operatorName: string;
  cardId: string;
}

export interface BackCardDesignConfig {
  id: string;
  ownerId?: string;
  name?: string; // Template name e.g. "แบบหลังบัตรมาตรฐาน"
  isDefault?: boolean; // Default back card template
  createdAt?: string;
  updatedAt?: string;
  displayMode: 'template' | 'imageOnly';
  title: string;
  subtitle: string;
  rules: string[];
  emergencyLabel: string;
  emergencyPhone: string;
  footerNote: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  bgImageUrl: string;
  bgImageStoragePath?: string;
  bgImageAssetId?: string;
  showLogo: boolean;
  showSignatureBox: boolean;
  signatureLabel: string;
}

export type PhotoPrintLayout = 'vertical' | 'horizontal';
export type PhotoHorizontalAlign = 'left' | 'center' | 'right';
export type PhotoVerticalAlign = 'top' | 'center' | 'bottom';

export interface PhotoMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PhotoPrintConfigPayload {
  layout: PhotoPrintLayout;
  paperOrientation: 'portrait' | 'landscape';
  photoWidthMm?: number;
  photoHeightMm?: number;
  gapMm: number;
  horizontalAlign?: PhotoHorizontalAlign;
  verticalAlign?: PhotoVerticalAlign;
  marginsMm?: PhotoMarginsMm;
  showCutLines: boolean;
  stripExtension: boolean;
  showGuardianName: boolean;
  fitMode: 'cover' | 'contain';
  assetIds: string[];
}

export interface ImageAssetReference {
  type: 'guardian' | 'front_design' | 'back_design' | 'sample_photo';
  id: string;
  label: string;
  detail?: string;
}

export interface FirestoreUsageBreakdownItem {
  key: string;
  label: string;
  count: number;
  bytes: number;
}

export interface FirestoreUsageSummary {
  quotaBytes: number;
  totalUsedBytes: number;
  remainingBytes: number;
  usedPercentage: number;
  imageAssetsBytes: number;
  otherDataBytes: number;
  totalDocuments: number;
  breakdown: FirestoreUsageBreakdownItem[];
}

export interface PrintHeaderPreset {
  id: string;
  ownerId?: string;
  title: string;
  subtitle?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryPrintConfigPayload {
  studentId: string;
  paperOrientation: 'portrait' | 'landscape';
  columnsPerRow: 1 | 2;
  repeatHeader: boolean;
  showPageNumbers: boolean;
  headerTitle: string;
  headerSubtitle: string;
  reportDate: string; // YYYY-MM-DD
  frontDesignId?: string;
}

export interface PrintPreviewPayload {
  id: string;
  createdAt: string;
  side: 'front' | 'back' | 'photo' | 'registry';
  trayConfig: TrayCalibrationConfig;
  enableSlot1: boolean;
  enableSlot2: boolean;
  slot1CardId?: string;
  slot2CardId?: string;
  slot1DesignId?: string;
  slot2DesignId?: string;
  slot1BackDesignId?: string;
  slot2BackDesignId?: string;
  backDesign?: BackCardDesignConfig;
  backSlot1Rotate180?: boolean;
  backSlot2Rotate180?: boolean;
  photoPrintConfig?: PhotoPrintConfigPayload;
  registryPrintConfig?: RegistryPrintConfigPayload;
  operatorName: string;
}

export interface FirebaseConfigState {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
  measurementId?: string;
  isConfigured: boolean;
}
