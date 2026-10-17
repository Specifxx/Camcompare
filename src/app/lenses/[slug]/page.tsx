import { notFound } from "next/navigation";
import { lens, publishedLenses } from "@/lib/catalog";
import LensView, { lensMetadata } from "@/views/LensView";

export const dynamicParams = false;
export const generateStaticParams = () => publishedLenses().map((l) => ({ slug: l.slug }));
export const generateMetadata = ({ params }: { params: { slug: string } }) => lensMetadata(params.slug, "us");

export default function Page({ params }: { params: { slug: string } }) {
  if (!lens(params.slug)) notFound();
  return <LensView slug={params.slug} market="us" />;
}
