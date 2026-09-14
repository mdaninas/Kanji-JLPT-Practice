import { useEffect, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import {
  extractComponents,
  fetchKanjiSvgText,
  getCachedBreakdown,
  setCachedBreakdown,
} from '../utils/kanjivg.js';

export function KanjiBreakdown({ t, character, onClose }) {
  const [components, setComponents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const modalRef = useFocusTrap();

  useEffect(() => {
    let cancelled = false;
    setError('');
    setComponents(null);

    const cached = getCachedBreakdown(character);
    if (cached) {
      setComponents(cached);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    fetchKanjiSvgText(character)
      .then((text) => {
        if (cancelled) return;
        const parts = extractComponents(text, character);
        setComponents(parts);
        setCachedBreakdown(character, parts);
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
          <span className="breakdownTargetGlyph" lang="ja">{character}</span>
          <span className="breakdownEquals">=</span>
          <div className="breakdownComponents">
            {loading && <div className="quietState modalEmpty">{t('breakdownLoading')}</div>}
            {!loading && error && <div className="loadError">{error}</div>}
            {!loading && !error && !hasComponents && (
              <div className="quietState modalEmpty">{t('breakdownEmpty')}</div>
            )}
            {!loading && !error && hasComponents && components.map((part, index) => (
              <article className="breakdownComponent" key={`${part.character}-${index}`}>
                <span className="breakdownComponentGlyph" lang="ja">{part.character}</span>
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
