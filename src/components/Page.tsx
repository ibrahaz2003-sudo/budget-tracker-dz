import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
