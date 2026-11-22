export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  contentType: string;
  extension: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  wasSvg: boolean;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

let cachedWebpSupportPromise: Promise<boolean> | null = null;

function supportsWebpEncode(): Promise<boolean> {
  if (cachedWebpSupportPromise) return cachedWebpSupportPromise;
  cachedWebpSupportPromise = (async () => {
    try {
      const c = document.createElement('canvas');
      c.width = 2;
      c.height = 2;
      const blob = await canvasToBlob(c, 'image/webp', 0.8);
      return Boolean(blob && blob.type === 'image/webp');
    } catch {
      return false;
    }
  })();
  return cachedWebpSupportPromise;
}

type DecodedSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

/**
 * Decodes image off the main thread via createImageBitmap when available,
 * falling back to HTMLImageElement for maximum browser compatibility.
 */
async function decodeImageFast(file: File): Promise<DecodedSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => {
          try {
            bitmap.close();
          } catch {
            // ignore
          }
        },
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/**
 * Fast alpha transparency check using a tiny 160x100 downsampled canvas
 * instead of scanning millions of pixels on the full-resolution canvas.
 */
function hasAlphaTransparencyFast(
  source: CanvasImageSource,
  fileType: string,
  width: number,
  height: number
): boolean {
  if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
    return false;
  }
  try {
    const probeW = Math.min(160, Math.max(1, width));
    const probeH = Math.min(100, Math.max(1, height));
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = probeW;
    probeCanvas.height = probeH;
    const pCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
    if (!pCtx) return false;
    pCtx.clearRect(0, 0, probeW, probeH);
    pCtx.drawImage(source, 0, 0, probeW, probeH);
    const { data } = pCtx.getImageData(0, 0, probeW, probeH);
    for (let i = 3; i < data.length; i += 8) {
      if (data[i] < 252) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export const MAX_FIRESTORE_DATAURL_CHARS = 780000;
export const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB upper bound for raw uploads
// Base64 expands binary size by ~4/3; below 550 KB binary is guaranteed under 780k chars
const SAFE_DIRECT_BLOB_BYTES = 550000;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const DANGEROUS_SVG_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'link',
  'meta',
  'base',
  'animate',
  'animatetransform',
  'animatemotion',
  'set',
  'handler',
  'listener',
]);

export function validateImageUploadFile(file: File): void {
  if (!file || file.size <= 0) {
    throw new Error('ไม่พบข้อมูลไฟล์รูปภาพ');
  }
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกิน 20 MB กรุณาเลือกไฟล์ขนาดเล็กลง');
  }
  if (file.type && !ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG, WebP, GIF หรือ SVG เท่านั้น');
  }
}

export function isSafeSvgMarkup(svgText: string): boolean {
  const lower = svgText.toLowerCase();
  if (
    lower.includes('<script') ||
    lower.includes('<foreignobject') ||
    lower.includes('<iframe') ||
    lower.includes('<object') ||
    lower.includes('<embed') ||
    lower.includes('javascript:') ||
    lower.includes('vbscript:') ||
    lower.includes('data:text/html') ||
    /\son[a-z]+\s*=/.test(lower)
  ) {
    return false;
  }
  return true;
}

export function sanitizeSvgContent(rawSvgText: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    if (!isSafeSvgMarkup(rawSvgText)) {
      throw new Error('ไฟล์ SVG มีคำสั่งที่ไม่อนุญาตเพื่อความปลอดภัย');
    }
    return rawSvgText;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvgText, 'image/svg+xml');
  const parseErrors = doc.getElementsByTagName('parsererror');
  const root = doc.documentElement;
  if (parseErrors.length > 0 || !root || root.localName.toLowerCase() !== 'svg') {
    throw new Error('โครงสร้างไฟล์ SVG ไม่ถูกต้องหรือไม่ปลอดภัย');
  }

  const cleanNodeTree = (el: Element): void => {
    const children = Array.from(el.children);
    for (const child of children) {
      const tag = child.localName.toLowerCase();
      if (DANGEROUS_SVG_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      cleanNodeTree(child);
    }

    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const attrName = attr.name.toLowerCase();
      const attrVal = attr.value.trim();
      const attrValLower = attrVal.toLowerCase();

      if (attrName.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (
        attrName === 'href' ||
        attrName === 'xlink:href' ||
        attrName === 'src' ||
        attrName === 'action' ||
        attrName === 'formaction'
      ) {
        // Allow only internal fragment references (#id) inside SVG to prevent SSRF / script execution
        if (!attrVal.startsWith('#')) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (
        attrName === 'style' &&
        (attrValLower.includes('javascript:') ||
          attrValLower.includes('vbscript:') ||
          attrValLower.includes('expression(') ||
          attrValLower.includes('-moz-binding') ||
          attrValLower.includes('behavior:') ||
          /url\(\s*['"]?\s*(?:https?:|\/\/|data:text\/html)/i.test(attrValLower))
      ) {
        el.removeAttribute(attr.name);
      }
    }

    if (el.localName.toLowerCase() === 'style') {
      const css = (el.textContent || '').toLowerCase();
      if (
        css.includes('javascript:') ||
        css.includes('expression(') ||
        css.includes('-moz-binding') ||
        css.includes('@import') ||
        /url\(\s*['"]?\s*(?:https?:|\/\/|data:text\/html)/i.test(css)
      ) {
        el.remove();
      }
    }
  };

  cleanNodeTree(root);
  const serialized = new XMLSerializer().serializeToString(root);
  if (!isSafeSvgMarkup(serialized)) {
    throw new Error('ไฟล์ SVG มีคำสั่งที่ไม่อนุญาตเพื่อความปลอดภัย');
  }
  return serialized;
}

async function processSvgFile(
  file: File,
  defaultWidth: number,
  defaultHeight: number
): Promise<CompressedImageResult> {
  const rawText = await file.text();
  const cleanSvg = sanitizeSvgContent(rawText);
  const cleanBlob = new Blob([cleanSvg], { type: 'image/svg+xml' });
  const dataUrl = await readFileAsDataUrl(cleanBlob);
  if (dataUrl.length > MAX_FIRESTORE_DATAURL_CHARS) {
    throw new Error('ไฟล์ SVG มีขนาดใหญ่เกินขีดจำกัด กรุณาเลือกไฟล์ขนาดเล็กลง');
  }
  return {
    blob: cleanBlob,
    dataUrl,
    contentType: 'image/svg+xml',
    extension: 'svg',
    originalSize: file.size,
    compressedSize: cleanBlob.size,
    width: defaultWidth,
    height: defaultHeight,
    wasSvg: true,
  };
}

async function encodeSinglePass(
  canvas: HTMLCanvasElement,
  transparent: boolean,
  quality: number
): Promise<Blob | null> {
  const canWebp = await supportsWebpEncode();
  if (canWebp) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality);
    if (webp && webp.type === 'image/webp') return webp;
  }
  if (transparent) {
    return canvasToBlob(canvas, 'image/png');
  }
  return canvasToBlob(canvas, 'image/jpeg', quality);
}

async function ensureWithinDataUrlLimit(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  initialBlob: Blob,
  transparent: boolean
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  let currentBlob = initialBlob;
  let width = canvas.width;
  let height = canvas.height;

  // Fast path: 99%+ of compressed images are well under 550 KB, so skip extra reads/loops
  if (currentBlob.size <= SAFE_DIRECT_BLOB_BYTES) {
    const directUrl = await readFileAsDataUrl(currentBlob);
    if (directUrl.length <= MAX_FIRESTORE_DATAURL_CHARS) {
      return { blob: currentBlob, dataUrl: directUrl, width, height };
    }
  }

  let currentDataUrl = await readFileAsDataUrl(currentBlob);
  if (currentDataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS) {
    return { blob: currentBlob, dataUrl: currentDataUrl, width, height };
  }

  for (const q of [0.7, 0.56]) {
    const candidate = await encodeSinglePass(canvas, transparent, q);
    if (candidate) {
      const url = await readFileAsDataUrl(candidate);
      if (url.length <= MAX_FIRESTORE_DATAURL_CHARS) {
        return { blob: candidate, dataUrl: url, width, height };
      }
      if (url.length < currentDataUrl.length) {
        currentBlob = candidate;
        currentDataUrl = url;
      }
    }
  }

  // Step down dimensions if still above Firestore document cap
  for (const scale of [0.75, 0.55]) {
    const w = Math.max(120, Math.round(canvas.width * scale));
    const h = Math.max(80, Math.round(canvas.height * scale));
    const scaled = document.createElement('canvas');
    scaled.width = w;
    scaled.height = h;
    const sCtx = scaled.getContext('2d');
    if (!sCtx) continue;
    sCtx.clearRect(0, 0, w, h);
    sCtx.drawImage(source, 0, 0, w, h);
    const pick = await encodeSinglePass(scaled, transparent, 0.7);
    if (pick) {
      const url = await readFileAsDataUrl(pick);
      width = w;
      height = h;
      currentBlob = pick;
      currentDataUrl = url;
      if (url.length <= MAX_FIRESTORE_DATAURL_CHARS) {
        return { blob: currentBlob, dataUrl: currentDataUrl, width, height };
      }
    }
  }

  return { blob: currentBlob, dataUrl: currentDataUrl, width, height };
}

const cardCompressionCache = new WeakMap<File, Promise<CompressedImageResult>>();
const avatarCompressionCache = new WeakMap<File, Promise<CompressedImageResult>>();
const elementCompressionCache = new WeakMap<File, Promise<CompressedImageResult>>();

async function runCompressCardImage(file: File): Promise<CompressedImageResult> {
  validateImageUploadFile(file);
  if (file.type === 'image/svg+xml') {
    return processSvgFile(file, 1011, 638);
  }

  const decoded = await decodeImageFast(file);
  try {
    // CR80 @ 300 DPI is 1011 x 638 px
    const MAX_W = 1024;
    const MAX_H = 650;
    let targetW = decoded.width || MAX_W;
    let targetH = decoded.height || MAX_H;

    const withinBounds = targetW <= MAX_W && targetH <= MAX_H;
    // Fast-skip re-encoding if file is already compact WebP/JPEG/PNG within target dimensions
    if (
      withinBounds &&
      file.size <= 140000 &&
      (file.type === 'image/webp' || file.type === 'image/jpeg' || file.type === 'image/png')
    ) {
      const directDataUrl = await readFileAsDataUrl(file);
      if (directDataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS) {
        return {
          blob: file,
          dataUrl: directDataUrl,
          contentType: file.type,
          extension: extensionFromMime(file.type),
          originalSize: file.size,
          compressedSize: file.size,
          width: targetW,
          height: targetH,
          wasSvg: false,
        };
      }
    }

    if (targetW > MAX_W || targetH > MAX_H) {
      const ratio = Math.min(MAX_W / targetW, MAX_H / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    const transparent = hasAlphaTransparencyFast(decoded.source, file.type, targetW, targetH);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackUrl = await readFileAsDataUrl(file);
      return {
        blob: file,
        dataUrl: fallbackUrl,
        contentType: file.type || 'image/png',
        extension: extensionFromMime(file.type || 'image/png'),
        originalSize: file.size,
        compressedSize: file.size,
        width: targetW,
        height: targetH,
        wasSvg: false,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(decoded.source, 0, 0, targetW, targetH);

    const encodedBlob = await encodeSinglePass(canvas, transparent, transparent ? 0.84 : 0.8);
    let chosenBlob = encodedBlob || file;

    if (
      withinBounds &&
      file.size < chosenBlob.size &&
      (file.type === 'image/webp' || file.type === 'image/jpeg' || file.type === 'image/png')
    ) {
      chosenBlob = file;
    }

    const bounded = await ensureWithinDataUrlLimit(canvas, decoded.source, chosenBlob, transparent);
    const contentType = bounded.blob.type || 'image/webp';
    return {
      blob: bounded.blob,
      dataUrl: bounded.dataUrl,
      contentType,
      extension: extensionFromMime(contentType),
      originalSize: file.size,
      compressedSize: bounded.blob.size,
      width: bounded.width,
      height: bounded.height,
      wasSvg: false,
    };
  } finally {
    decoded.release();
  }
}

async function runCompressAvatarPhoto(file: File): Promise<CompressedImageResult> {
  validateImageUploadFile(file);
  if (file.type === 'image/svg+xml') {
    return processSvgFile(file, 400, 480);
  }

  const decoded = await decodeImageFast(file);
  try {
    // Portrait on CR80 card is ~300x360 px at 300 DPI; 480x580 retains ample clarity
    const MAX_W = 480;
    const MAX_H = 580;
    let targetW = decoded.width || MAX_W;
    let targetH = decoded.height || MAX_H;

    const withinBounds = targetW <= MAX_W && targetH <= MAX_H;
    if (
      withinBounds &&
      file.size <= 80000 &&
      (file.type === 'image/webp' || file.type === 'image/jpeg')
    ) {
      const directDataUrl = await readFileAsDataUrl(file);
      if (directDataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS) {
        return {
          blob: file,
          dataUrl: directDataUrl,
          contentType: file.type,
          extension: extensionFromMime(file.type),
          originalSize: file.size,
          compressedSize: file.size,
          width: targetW,
          height: targetH,
          wasSvg: false,
        };
      }
    }

    if (targetW > MAX_W || targetH > MAX_H) {
      const ratio = Math.min(MAX_W / targetW, MAX_H / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackUrl = await readFileAsDataUrl(file);
      return {
        blob: file,
        dataUrl: fallbackUrl,
        contentType: file.type || 'image/jpeg',
        extension: extensionFromMime(file.type || 'image/jpeg'),
        originalSize: file.size,
        compressedSize: file.size,
        width: targetW,
        height: targetH,
        wasSvg: false,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(decoded.source, 0, 0, targetW, targetH);

    const encodedBlob = await encodeSinglePass(canvas, false, 0.8);
    let chosenBlob = encodedBlob || file;

    if (
      withinBounds &&
      file.size < chosenBlob.size &&
      (file.type === 'image/jpeg' || file.type === 'image/webp')
    ) {
      chosenBlob = file;
    }

    const bounded = await ensureWithinDataUrlLimit(canvas, decoded.source, chosenBlob, false);
    const contentType = bounded.blob.type || 'image/webp';
    return {
      blob: bounded.blob,
      dataUrl: bounded.dataUrl,
      contentType,
      extension: extensionFromMime(contentType),
      originalSize: file.size,
      compressedSize: bounded.blob.size,
      width: bounded.width,
      height: bounded.height,
      wasSvg: false,
    };
  } finally {
    decoded.release();
  }
}

/**
 * Always compresses raster card artwork / backgrounds before uploading to Firebase.
 * Preserves alpha transparency (e.g., guardian photo cutout windows) using WebP/PNG.
 */
export function compressCardImage(file: File): Promise<CompressedImageResult> {
  const existing = cardCompressionCache.get(file);
  if (existing) return existing;
  const promise = runCompressCardImage(file).catch((err) => {
    cardCompressionCache.delete(file);
    throw err;
  });
  cardCompressionCache.set(file, promise);
  return promise;
}

/**
 * Always compresses guardian portrait photos / designer sample photos before uploading to Firebase.
 * Results are cached per File instance so pre-compression on file selection makes submit instant.
 */
export function compressAvatarPhoto(file: File): Promise<CompressedImageResult> {
  const existing = avatarCompressionCache.get(file);
  if (existing) return existing;
  const promise = runCompressAvatarPhoto(file).catch((err) => {
    avatarCompressionCache.delete(file);
    throw err;
  });
  avatarCompressionCache.set(file, promise);
  return promise;
}

async function runCompressElementImage(file: File): Promise<CompressedImageResult> {
  validateImageUploadFile(file);
  if (file.type === 'image/svg+xml') {
    return processSvgFile(file, 512, 512);
  }

  const decoded = await decodeImageFast(file);
  try {
    const MAX_W = 640;
    const MAX_H = 640;
    let targetW = decoded.width || MAX_W;
    let targetH = decoded.height || MAX_H;

    const withinBounds = targetW <= MAX_W && targetH <= MAX_H;
    if (
      withinBounds &&
      file.size <= 120000 &&
      (file.type === 'image/webp' || file.type === 'image/jpeg' || file.type === 'image/png')
    ) {
      const directDataUrl = await readFileAsDataUrl(file);
      if (directDataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS) {
        return {
          blob: file,
          dataUrl: directDataUrl,
          contentType: file.type,
          extension: extensionFromMime(file.type),
          originalSize: file.size,
          compressedSize: file.size,
          width: targetW,
          height: targetH,
          wasSvg: false,
        };
      }
    }

    if (targetW > MAX_W || targetH > MAX_H) {
      const ratio = Math.min(MAX_W / targetW, MAX_H / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    const transparent = hasAlphaTransparencyFast(decoded.source, file.type, targetW, targetH);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackUrl = await readFileAsDataUrl(file);
      return {
        blob: file,
        dataUrl: fallbackUrl,
        contentType: file.type || 'image/png',
        extension: extensionFromMime(file.type || 'image/png'),
        originalSize: file.size,
        compressedSize: file.size,
        width: targetW,
        height: targetH,
        wasSvg: false,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(decoded.source, 0, 0, targetW, targetH);

    const encodedBlob = await encodeSinglePass(canvas, transparent, transparent ? 0.88 : 0.84);
    let chosenBlob = encodedBlob || file;

    if (
      withinBounds &&
      file.size < chosenBlob.size &&
      (file.type === 'image/webp' || file.type === 'image/jpeg' || file.type === 'image/png')
    ) {
      chosenBlob = file;
    }

    const bounded = await ensureWithinDataUrlLimit(canvas, decoded.source, chosenBlob, transparent);
    const contentType = bounded.blob.type || 'image/webp';
    return {
      blob: bounded.blob,
      dataUrl: bounded.dataUrl,
      contentType,
      extension: extensionFromMime(contentType),
      originalSize: file.size,
      compressedSize: bounded.blob.size,
      width: bounded.width,
      height: bounded.height,
      wasSvg: false,
    };
  } finally {
    decoded.release();
  }
}

/**
 * Compresses card element images (QR Code / School Logo) while preserving alpha transparency.
 */
export function compressElementImage(file: File): Promise<CompressedImageResult> {
  const existing = elementCompressionCache.get(file);
  if (existing) return existing;
  const promise = runCompressElementImage(file).catch((err) => {
    elementCompressionCache.delete(file);
    throw err;
  });
  elementCompressionCache.set(file, promise);
  return promise;
}

/**
 * Starts compressing an avatar photo in the background immediately upon file selection.
 */
export function precompressAvatarPhoto(file: File): Promise<CompressedImageResult> {
  return compressAvatarPhoto(file);
}

/**
 * Backward-compatible helper returning compressed data URL.
 */
export async function optimizeCardImageFile(file: File): Promise<string> {
  const result = await compressCardImage(file);
  return result.dataUrl;
}

/**
 * Converts a legacy base64 data:image/... URL into a File so it can be compressed
 * and uploaded to Firebase automatically.
 */
export function dataUrlToFile(dataUrl: string, baseName: string): File | null {
  try {
    if (!dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
      return null;
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const isBase64 = header.includes(';base64');
    if (!isBase64) return null;

    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const ext = extensionFromMime(mime);
    return new File([bytes], `${baseName}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}
