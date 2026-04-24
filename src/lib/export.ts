import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from './api';

export async function saveExcel<T extends object>(
  rows: T[],
  sheetName: string,
  defaultFileName: string
) {
  if (rows.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  const result = await api.showSaveDialog({
    defaultPath: defaultFileName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return;

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, result.filePath);
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
  const result = await api.showSaveDialog({
    defaultPath: defaultFileName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return;

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
  doc.save(result.filePath);
}
