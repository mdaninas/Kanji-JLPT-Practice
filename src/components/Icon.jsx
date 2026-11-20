const paths = {
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  cards: 'M6 7H4v13h12v-2 M8 4h12v12H8z',
  quiz: 'M14 3H6v18h12V7z M14 3v4h4 M9 13l2 2 4-4',
  chart: 'M4 4v16h16 M8 16v-4 M13 16V8 M18 16V5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M19 5l-1.5 1.5 M5 19l1.5-1.5',
  moon: 'M20 15a8.5 8.5 0 0 1-11-11A8.5 8.5 0 1 0 20 15z',
  arrowDown: 'M12 4v15 M6 13l6 6 6-6',
  arrowRight: 'M4 12h15 M13 6l6 6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0z M14.5 14.5 20 20',
  sort: 'M4 6h16 M7 12h10 M10 18h4',
  shuffle: 'M3 6h3c3 0 5 3 7 7 1.4 2.7 2.8 5 5 5h3 M18 15l3 3-3 3 M3 18h3c2 0 3.2-1.2 4.3-3 M14 9c1.1-1.8 2.3-3 4-3h3 M18 3l3 3-3 3',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2',
  plus: 'M12 5v14 M5 12h14',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12 M18 6 6 18',
  pen: 'm4 20 4-.8L20 7l-3-3L5 16z M15 6l3 3',
  components: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h16v7H4z',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg
      className="uiIcon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
