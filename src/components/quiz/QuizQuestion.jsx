import {
  formatQuizExplanation,
  getQuizSentenceParts,
  getQuizSentenceTranslation,
  getQuizSentenceVocabWords,
  getQuizWordTranslation,
} from '../../utils.js';
import { renderHighlightedSentenceSegment } from '../../utils/highlight.jsx';
import { SpeakerButton } from '../ReadingLines.jsx';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

export function QuizQuestion({ t, question, language, selectedAnswer, onAnswer, onNext, isActive }) {
  const sentenceParts = getQuizSentenceParts(question);
  const sentenceVocabWords = getQuizSentenceVocabWords(question);
  const secondaryHighlightWords = sentenceVocabWords.filter((w) => w !== sentenceParts.target);
  const wordTranslation = getQuizWordTranslation(question);
  const sentenceTranslation = getQuizSentenceTranslation(question);
  const isRevealed = Boolean(selectedAnswer);

  return (
    <article className="quizQuestion" id={`q-${question.id}`}>
      <p className="quizPrompt">{question.question}</p>
      <div className="contextSentence" lang="ja">
        <span>{renderHighlightedSentenceSegment(sentenceParts.before, secondaryHighlightWords)}</span>
        <mark>{sentenceParts.target}</mark>
        <span>{renderHighlightedSentenceSegment(sentenceParts.after, secondaryHighlightWords)}</span>
      </div>

      <div className="choiceList">
        {ANSWER_LABELS.map((label) => {
          const isSelected = selectedAnswer === label;
          const isCorrect = question.answer === label;
          const className = [
            isRevealed && isCorrect ? 'correctChoice' : '',
            isRevealed && isSelected && !isCorrect ? 'wrongChoice' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              type="button"
              className={className}
              key={label}
              onClick={() => !isRevealed && onAnswer(label)}
              disabled={isRevealed && !isCorrect && !isSelected}
            >
              <strong>{label}</strong>
              {question.choices[label]}
            </button>
          );
        })}
      </div>

      {isRevealed && (
        <>
          <div className="answerPill">
            {t('correctAnswer')}: {question.answer} - {question.answer_reading}
            {question.answer_reading && (
              <SpeakerButton text={question.answer_reading} label={t('playAudio')} />
            )}
          </div>
          {sentenceVocabWords.length > 0 && (
            <div className="sentenceVocabList">
              <strong>{t('sentenceVocab')}</strong>
              <div>
                {sentenceVocabWords.map((word) => <span key={word}>{word}</span>)}
              </div>
            </div>
          )}
          {wordTranslation && (
            <div className="translationPill">
              <strong>{t('wordTranslation')}</strong>
              <span>{wordTranslation}</span>
            </div>
          )}
          {sentenceTranslation && (
            <div className="translationPill sentenceMeaning">
              <strong>{t('sentenceTranslation')}</strong>
              <span>{sentenceTranslation}</span>
            </div>
          )}
          <small>{formatQuizExplanation(language, question)}</small>
          {isActive && (
            <button type="button" className="nextQuestionBtn" onClick={onNext}>
              Enter → {t('close') === 'Tutup' ? 'Soal berikutnya' : 'Next question'}
            </button>
          )}
        </>
      )}
    </article>
  );
}
