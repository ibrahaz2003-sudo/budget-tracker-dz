import type { ReactNode } from 'react';
import { useLongPressHandlers } from '../lib/useLongPress';

interface Props {
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}

// Table row wrapper that triggers `onEdit` on long-press (mobile) or
// right-click (desktop). Used to make every data row in the app editable
// with a familiar gesture, in addition to the visible pencil button.
export function LongPressRow({ onEdit, className, children }: Props) {
  const handlers = useLongPressHandlers(onEdit);
  return (
    <tr className={className} {...handlers}>
      {children}
    </tr>
  );
}

interface LiProps {
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}

export function LongPressLi({ onEdit, className, children }: LiProps) {
  const handlers = useLongPressHandlers(onEdit);
  return (
    <li className={className} {...handlers}>
      {children}
    </li>
  );
}

interface DivProps {
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}

export function LongPressDiv({ onEdit, className, children }: DivProps) {
  const handlers = useLongPressHandlers(onEdit);
  return (
    <div className={className} {...handlers}>
      {children}
    </div>
  );
}
