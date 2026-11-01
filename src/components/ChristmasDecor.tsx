// Christmas set dressing for the home hero (owner, 2026-11-01: "Christmas trees, maybe like a Santa hat … stockings …
// candy canes"): falling snow, a strand of twinkling lights along the top, a tree and a present in the bottom-left corner,
// a candy cane and a small tree in the bottom-right, either side of the centred text. Pure decoration: aria-hidden,
// pointer-events none, under the content. It is in the HTML all year (a few hundred bytes) and shown only while <html>
// carries data-season="christmas" (src/lib/season.ts, 1 November to Boxing Day; globals.css "xmas-common").
export function ChristmasDecor() {
  return (
    <div className="xmas-only xmas-hero" aria-hidden="true">
      <span className="xmas-snow" />
      <span className="xmas-lights" />
      <span className="xmas-corner xmas-corner-l">
        <span className="xmas-art xmas-tree" />
        <span className="xmas-art xmas-gift" />
      </span>
      <span className="xmas-corner xmas-corner-r">
        <span className="xmas-art xmas-cane" />
        <span className="xmas-art xmas-tree xmas-tree-sm" />
      </span>
    </div>
  );
}
