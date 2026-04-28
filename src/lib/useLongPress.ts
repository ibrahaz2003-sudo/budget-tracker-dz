import { useRef, type TouchEvent, type MouseEvent } from 'react';

// Returns event handlers that can be spread onto a row to trigger
// `onLongPress` after `ms` of sustained touch. Designed to be used with the
// LongPressRow / LongPressLi wrappers below (so the hook is called from a
// component, not inside a .map closure).
export function useLongPressHandlers(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);

  const start = () => {
    triggered.current = false;
    timer.current = window.setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, ms);
  };

  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onTouchStart: () => start(),
    onTouchEnd: () => clear(),
    onTouchMove: () => clear(),
    onTouchCancel: () => clear(),
    // Desktop fallback so right-click also triggers edit on rows.
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    // Cancel timer if user actually taps (short press) — this prevents the
    // long-press from firing at the end of a short touch sequence.
    onTouchEndCapture: (_e: TouchEvent) => clear(),
  };
}
