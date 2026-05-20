import { useEffect, useRef, useState } from 'react';

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji';

function unicodeFileName(character) {
  const code = character.codePointAt(0).toString(16).padStart(5, '0');
  return `${code}.svg`;
}

function parseSvgSafely(rawSvg) {
  // Parse SVG via DOMParser, then strip <script> elements and inline event
  // handlers (on*) before returning. Safer than regex-based string scrubbing.
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;

  doc.querySelectorAll('script').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'href' && attribute.value.startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return doc.documentElement;
}

export function StrokeOrder({ t, character, onClose }) {
  const [svgElement, setSvgElement] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSvgElement(null);

    fetch(`${CDN_BASE}/${unicodeFileName(character)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
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

  // Mount sanitized SVG element into the container.
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
      path.style.stroke = '#1f7a70';
      path.style.fill = 'none';
      path.style.strokeWidth = '3';
      path.style.strokeLinecap = 'round';
      path.style.strokeLinejoin = 'round';
      path.style.transition = 'none';
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });

    if (!isPlaying) return undefined;

    // Web Animations API draws each stroke at a constant 0.18 px/ms pace and
    // sequences them with a short gap. Transition-delay accumulation in CSS
    // was glitchy on kanji with many strokes; the WAAPI keeps timing precise
    // and lets us cancel cleanly on replay/unmount.
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
