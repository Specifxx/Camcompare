import { notFound } from "next/navigation";
import { mount } from "@/lib/catalog";
import MountView, { liveMounts, mountMetadata } from "@/views/MountView";

export const dynamicParams = false;
export const generateStaticParams = () => liveMounts().map((m) => ({ mount: m.slug }));
export const generateMetadata = ({ params }: { params: { mount: string } }) => mountMetadata(params.mount, "us");

export default function Page({ params }: { params: { mount: string } }) {
  if (!mount(params.mount)) notFound();
  return <MountView slug={params.mount} market="us" />;
}
