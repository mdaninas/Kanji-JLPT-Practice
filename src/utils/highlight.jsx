export function renderHighlightedSentenceSegment(text, highlightWords) {
  const words = [...new Set(highlightWords)]
    .filter((word) => word && text.includes(word))
    .sort((first, second) => second.length - first.length);
  const nodes = [];
  let index = 0;

  while (index < text.length) {
    const matchedWord = words.find((word) => text.startsWith(word, index));
    if (matchedWord) {
      nodes.push(
        <mark className="secondaryHighlight" key={`${matchedWord}-${index}`}>
          {matchedWord}
        </mark>,
      );
      index += matchedWord.length;
      continue;
    }
    nodes.push(text[index]);
    index += 1;
  }

  return nodes;
}
