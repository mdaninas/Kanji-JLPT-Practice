import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import {
  fetchKanjiSvgText,
  parseSvgSafely,
  prefersReducedMotion,
} from '../utils/kanjivg.js';

export function StrokeOrder({ t, character, onClose }) {
  const [svgElement, setSvgElement] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const containerRef = useRef(null);
  const modalRef = useFocusTrap();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSvgElement(null);
    setIsPlaying(!prefersReducedMotion());

    fetchKanjiSvgText(character)
      .then((text) => {
        if (cancelled) return;
        const parsed = parseSvgSafely(text);
        if (!parsed) {
          setError(t('strokeOrderError'));
          return;
        }
        setSvgElement(parsed);
      })
      .catch(() => {
        if (!cancelled) setError(t('strokeOrderError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [character, t]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.replaceChildren();
    if (svgElement) root.appendChild(svgElement);
  }, [svgElement]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !svgElement) return undefined;
    const paths = Array.from(root.querySelectorAll('path'));
    const animations = [];

    paths.forEach((path) => {
      const length = path.getTotalLength?.() || 100;
      path.style.transition = 'none';
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });

    if (!isPlaying) return undefined;

    const PX_PER_MS = 0.18;
    const GAP_MS = 90;
    let delay = 0;

    paths.forEach((path) => {
      const length = path.getTotalLength?.() || 100;
      const duration = Math.max(260, Math.round(length / PX_PER_MS));
      const animation = path.animate(
        [
          { strokeDashoffset: String(length) },
          { strokeDashoffset: '0' },
        ],
        { duration, delay, easing: 'linear', fill: 'forwards' },
      );
      animations.push(animation);
      delay += duration + GAP_MS;
    });

    return () => animations.forEach((animation) => animation.cancel());
  }, [svgElement, isPlaying]);

  function replay() {
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 60);
  }

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        className="strokeOrderModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stroke-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">{t('strokeOrder')}</p>
            <h2 id="stroke-title">{t('strokeOrderTitle', { kanji: character })}</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t('close')}>
            x
          </button>
        </div>

        <div className="strokeStage">
          {loading && <div className="quietState">{t('strokeOrderLoading')}</div>}
          {error && <div className="loadError">{error}</div>}
          {!loading && !error && (
            <div className="strokeSvgWrapper" ref={containerRef} />
          )}
        </div>

        <div className="modalFooter">
          <button
            type="button"
            className="paperButton"
            onClick={replay}
            disabled={loading || Boolean(error)}
          >
            {t('strokeOrderReplay')}
          </button>
          <button type="button" className="paperButton" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </section>
    </div>
  );
}
