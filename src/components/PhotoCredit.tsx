import type { ImageCredit } from "@/lib/images";

export default function PhotoCredit({ credit }: { credit: ImageCredit | null }) {
  if (!credit) return null;
  return (
    <figcaption className="mt-1 text-[11px] text-subtle">
      Photo: {credit.author},{" "}
      <a href={credit.pageUrl} rel="nofollow noopener" target="_blank">
        {credit.license}
      </a>
      {credit.source === "press" ? " (press image)" : ""}
    </figcaption>
  );
}
