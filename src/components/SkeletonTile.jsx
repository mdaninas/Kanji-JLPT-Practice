export function SkeletonGrid({ count = 12 }) {
  return (
    <div className="kanjiGrid skeletonGrid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="kanjiTile skeletonTile" key={i}>
          <div className="skeletonGlyph" />
          <div className="skeletonLine skeletonLineWide" />
          <div className="skeletonLine" />
          <div className="skeletonLine skeletonLineNarrow" />
        </div>
      ))}
    </div>
  );
}
