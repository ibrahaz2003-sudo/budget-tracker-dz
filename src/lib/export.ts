import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from './api';

// On Electron we get a real native Save-As dialog with a file path.
// On Capacitor / browser we fall back to triggering a download via a blob URL,
// which the OS then routes through its own Save / Share intent.
const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.api;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveExcel<T extends object>(
  rows: T[],
  sheetName: string,
  defaultFileName: string
) {
  if (rows.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (isElectron()) {
    const result = await api.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return;
    XLSX.writeFile(wb, result.filePath);
    return;
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  triggerDownload(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    defaultFileName
  );
}

export async function savePdf(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  defaultFileName: string
) {
  if (rows.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  if (isElectron()) {
    const result = await api.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return;
    doc.save(result.filePath);
    return;
  }

  triggerDownload(doc.output('blob') as Blob, defaultFileName);
}
