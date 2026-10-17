import { notFound } from "next/navigation";
import { mount } from "@/lib/catalog";
import MountView, { liveMounts, mountMetadata } from "@/views/MountView";
import { marketParam } from "../../market";

export const dynamicParams = false;
export const generateStaticParams = () => liveMounts().map((m) => ({ mount: m.slug }));
type P = { params: { market: string; mount: string } };
export const generateMetadata = ({ params }: P) => mountMetadata(params.mount, marketParam(params));
export default function Page({ params }: P) {
  if (!mount(params.mount)) notFound();
  return <MountView slug={params.mount} market={marketParam(params)} />;
}
