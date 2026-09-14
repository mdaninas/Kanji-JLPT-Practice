import { formatReadings, isSpeechSynthesisSupported, speakJapanese } from '../utils.js';

function cleanReadingForSpeech(reading) {
  return String(reading || '').replace(/[.\-‐]/g, '');
}

export function SpeakerButton({ text, label }) {
  const supported = isSpeechSynthesisSupported();
  return (
    <button
      type="button"
      className="speakerBtn"
      onClick={(event) => {
        event.stopPropagation();
        speakJapanese(cleanReadingForSpeech(text));
      }}
      disabled={!supported}
      aria-label={label}
      title={label}
    >
      🔊
    </button>
  );
}

export function ReadingLines({ t, kanji, compact = false, maxReadings = 3, speakLabel = '' }) {
  const onLabel = t ? t('onReadings') : 'On';
  const kunLabel = t ? t('kunReadings') : 'Kun';
  const onReadings = kanji.onReadings || [];
  const kunReadings = kanji.kunReadings || [];

  const cleanedKun = kunReadings.filter(Boolean);
  const speakableKun = cleanedKun.map(cleanReadingForSpeech).filter(Boolean).join('、');
  const cleanedOn = onReadings.filter(Boolean);
  const speakableOn = cleanedOn.map(cleanReadingForSpeech).filter(Boolean).join('、');

  if (compact) {
    return <div className="readingLines compact" aria-hidden="true" />;
  }

  return (
    <div className="readingLines">
      {cleanedOn.length > 0 && (
        <span>
          <strong>{onLabel}</strong>
          <span lang="ja">{formatReadings(onReadings, maxReadings)}</span>
          {speakLabel && speakableOn && (
            <SpeakerButton text={speakableOn} label={speakLabel} />
          )}
        </span>
      )}
      {cleanedKun.length > 0 && (
        <span>
          <strong>{kunLabel}</strong>
          <span lang="ja">{formatReadings(kunReadings, maxReadings)}</span>
          {speakLabel && speakableKun && (
            <SpeakerButton text={speakableKun} label={speakLabel} />
          )}
        </span>
      )}
    </div>
  );
}
