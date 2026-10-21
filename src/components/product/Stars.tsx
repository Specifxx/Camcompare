import { starText } from "./review-data";

/** Five stars, filled to the nearest half, for an average out of 5. */
export default function Stars({ value, className = "" }: { value: number; className?: string }) {
  const { full, half, empty } = starText(value);
  return (
    <span className={`inline-flex text-accent ${className}`} aria-label={`${value.toFixed(1)} out of 5 stars`} role="img">
      {Array.from({ length: full }, (_, i) => (
        <span key={`f${i}`} aria-hidden>★</span>
      ))}
      {half ? (
        <span aria-hidden className="relative">
          <span className="text-line">★</span>
          <span className="absolute inset-0 w-1/2 overflow-hidden">★</span>
        </span>
      ) : null}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} aria-hidden className="text-line">★</span>
      ))}
    </span>
  );
}
