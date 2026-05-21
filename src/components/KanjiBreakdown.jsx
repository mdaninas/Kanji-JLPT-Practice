import { useEffect, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji';
const CACHE_KEY = 'kanjiBreakdownCache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KVG_NS = 'http://kanjivg.tagaini.net';

function unicodeFileName(character) {
  const code = character.codePointAt(0).toString(16).padStart(5, '0');
  return `${code}.svg`;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

function getCached(character) {
  const cache = readCache();
  const entry = cache[character];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  return entry.components;
}

function setCached(character, components) {
  const cache = readCache();
  cache[character] = { components, savedAt: Date.now() };
  writeCache(cache);
}

// Parse KanjiVG SVG and extract first-level components.
// The SVG contains <g kvg:element="<kanji>"> wrapping nested <g kvg:element="<part>">
// groups. We collect the immediate children that have their own kvg:element value
// (different from the root character) and treat them as components.
function extractComponents(rawSvg, character) {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return [];

  const groups = doc.querySelectorAll('g');
  let rootGroup = null;
  groups.forEach((group) => {
    if (rootGroup) return;
    if (group.getAttributeNS(KVG_NS, 'element') === character) rootGroup = group;
  });
  if (!rootGroup) return [];

  const result = [];
  rootGroup.querySelectorAll(':scope > g').forEach((child) => {
    const element = child.getAttributeNS(KVG_NS, 'element');
    if (!element || element === character) return;
    result.push({
      character: element,
      position: child.getAttributeNS(KVG_NS, 'position') || '',
      radical: child.getAttributeNS(KVG_NS, 'radical') || '',
    });
  });

  // If the root has no labelled sub-groups, fall back to any descendant groups
  // with kvg:element. Avoids returning an empty list for kanji whose top-level
  // group is unsplit but whose nested groups still describe parts.
  if (result.length === 0) {
    rootGroup.querySelectorAll('g').forEach((child) => {
      const element = child.getAttributeNS(KVG_NS, 'element');
      if (!element || element === character) return;
      if (result.some((item) => item.character === element)) return;
      result.push({
        character: element,
        position: child.getAttributeNS(KVG_NS, 'position') || '',
        radical: child.getAttributeNS(KVG_NS, 'radical') || '',
      });
    });
  }

  return result;
}

export function KanjiBreakdown({ t, character, onClose }) {
  const [components, setComponents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const modalRef = useFocusTrap();

  useEffect(() => {
    let cancelled = false;
    setError('');
    setComponents(null);

    const cached = getCached(character);
    if (cached) {
      setComponents(cached);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    fetch(`${CDN_BASE}/${unicodeFileName(character)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parts = extractComponents(text, character);
        setComponents(parts);
        setCached(character, parts);
      })
      .catch(() => {
        if (!cancelled) setError(t('breakdownError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [character, t]);

  const hasComponents = components && components.length > 0;

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        className="breakdownModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">{t('breakdownLabel')}</p>
            <h2 id="breakdown-title">{t('breakdownTitle', { kanji: character })}</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t('close')}>
            x
          </button>
        </div>

        <p className="modalIntro">{t('breakdownSubtitle')}</p>

        <div className="breakdownStage">
          <span className="breakdownTargetGlyph">{character}</span>
          <span className="breakdownEquals">=</span>
          <div className="breakdownComponents">
            {loading && <div className="quietState modalEmpty">{t('breakdownLoading')}</div>}
            {!loading && error && <div className="loadError">{error}</div>}
            {!loading && !error && !hasComponents && (
              <div className="quietState modalEmpty">{t('breakdownEmpty')}</div>
            )}
            {!loading && !error && hasComponents && components.map((part, index) => (
              <article className="breakdownComponent" key={`${part.character}-${index}`}>
                <span className="breakdownComponentGlyph">{part.character}</span>
                {(part.position || part.radical) && (
                  <span className="breakdownComponentMeta">
                    {part.position && <em>{part.position}</em>}
                    {part.radical && <em className="radicalTag">{t('breakdownRadicalTag')}</em>}
                  </span>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="modalFooter">
          <button type="button" className="paperButton" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </section>
    </div>
  );
}
