import { PrintPreviewPayload } from '../types';
import { storageService } from './storage';

export function openPrintPreviewInNewTab(
  payload: PrintPreviewPayload
): { opened: boolean; url: string } {
  storageService.savePrintPreviewPayload(payload);

  const previewUrl = new URL(window.location.href);
  previewUrl.searchParams.set('printPreview', payload.side);
  previewUrl.searchParams.set('previewId', payload.id);
  const urlString = previewUrl.toString();

  const newWindow = window.open(urlString, '_blank');
  if (newWindow) {
    newWindow.opener = null;
    return { opened: true, url: urlString };
  }

  return { opened: false, url: urlString };
}
