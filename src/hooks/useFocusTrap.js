import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(element) {
  // offsetParent is null for display:none AND position:fixed elements,
  // so combine with getClientRects() to keep fixed children focusable.
  return !!(
    element.offsetWidth
    || element.offsetHeight
    || element.getClientRects().length
  );
}

export function useFocusTrap(isActive = true) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previousFocus = document.activeElement;

    function getFocusables() {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
    }

    const initial = getFocusables();
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container.focus();
    }

    function handleKeyDown(event) {
      if (event.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const insideContainer = container.contains(active);

      if (event.shiftKey) {
        if (active === first || !insideContainer) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !insideContainer) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}
