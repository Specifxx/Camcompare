import { notFound } from "next/navigation";
import { camera, publishedCameras } from "@/lib/catalog";
import CameraView, { cameraMetadata } from "@/views/CameraView";

// Static: the catalog is files in the repo, so prerendering every camera
// reads no database (RiftCompare's rule against generateStaticParams is about
// DB-backed routes).
export const dynamicParams = false;
export const generateStaticParams = () => publishedCameras().map((c) => ({ slug: c.slug }));
export const generateMetadata = ({ params }: { params: { slug: string } }) => cameraMetadata(params.slug, "us");

export default function Page({ params }: { params: { slug: string } }) {
  if (!camera(params.slug)) notFound();
  return <CameraView slug={params.slug} market="us" />;
}
