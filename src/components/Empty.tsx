import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function Empty({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-slate-100 rounded-full p-4 mb-3">
        <Inbox size={28} className="text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 mb-4">{message}</p>
      {action}
    </div>
  );
}
