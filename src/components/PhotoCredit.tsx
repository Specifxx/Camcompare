import type { ImageCredit } from "@/lib/images";

export default function PhotoCredit({ credit }: { credit: ImageCredit | null }) {
  if (!credit) return null;
  return (
    <figcaption className="mt-1 text-[11px] text-subtle">
      {/* Author to the photo's page, licence name to the licence (CC 4.0 §3(a)(1)), as on /credits. */}
      Photo:{" "}
      <a href={credit.pageUrl} rel="nofollow noopener" target="_blank">
        {credit.author}
      </a>
      ,{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} rel="nofollow noopener" target="_blank">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {credit.source === "press" ? " (press image)" : ""}
    </figcaption>
  );
}
