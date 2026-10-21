import type { GalleryImage } from "@/lib/gallery";
import PhotoCredit from "@/components/PhotoCredit";
import ProductThumb from "@/components/ProductThumb";
import GalleryViewer from "./GalleryViewer";

/**
 * The hero photo. One licensed photo per product today (its thumbnail);
 * when data/gallery/<slug>.json adds more, they show as a strip of
 * thumbnails under it (GalleryViewer, client). Every photo keeps its credit.
 */
export default function Gallery({ slug, images }: { slug: string; images: GalleryImage[] }) {
  if (images.length > 1) return <GalleryViewer images={images} />;
  return (
    <figure>
      <ProductThumb slug={slug} alt={images[0]?.alt ?? ""} priority className="border border-line" />
      <PhotoCredit credit={images[0]?.credit ?? null} />
    </figure>
  );
}
