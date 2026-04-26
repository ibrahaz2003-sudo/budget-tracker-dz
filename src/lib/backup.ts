import { api } from './api';

// Delivery is split by runtime:
// - Electron: native Save-As dialog (filesystem).
// - Capacitor (Android): write file to cache via @capacitor/filesystem, open
//   native share sheet via @capacitor/share so the user can send it to
//   Drive / Dropbox / any installed app.
// - Web dev fallback: blob download (<a download>).

const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.api;

const isCapacitor = (): boolean => {
  if (typeof window === 'undefined' || window.api) return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return !!cap?.isNativePlatform?.();
};

function defaultFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `budget-tracker-dz-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export async function runBackupExport(): Promise<string> {
  const dump = await api.exportBackup();
  const json = JSON.stringify(dump, null, 2);
  const filename = defaultFilename();

  if (isElectron()) {
    const result = await api.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return 'canceled';
    await api.writeFile(result.filePath, json);
    return `saved:${result.filePath}`;
  }

  if (isCapacitor()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });
    await Share.share({
      title: 'نسخة احتياطية — Budget Tracker DZ',
      text: 'نسخة احتياطية من بياناتك. ارفعها على Google Drive أو Dropbox أو أي مكان تختاره.',
      url: uri,
      dialogTitle: 'مشاركة النسخة الاحتياطية',
    });
    return `shared:${filename}`;
  }

  triggerDownload(new Blob([json], { type: 'application/json' }), filename);
  return `downloaded:${filename}`;
}

export async function runBackupImport(file: File): Promise<{
  ok: true;
  restored_tables: number;
}> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف ليس JSON صالح');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('data' in parsed) ||
    typeof (parsed as { data: unknown }).data !== 'object'
  ) {
    throw new Error('الملف ليس نسخة احتياطية صالحة (مفقود data)');
  }
  const payload = parsed as { data: Record<string, Record<string, unknown>[]> };
  return api.importBackup({ data: payload.data });
}

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
