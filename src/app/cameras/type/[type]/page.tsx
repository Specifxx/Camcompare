import { notFound } from "next/navigation";
import HubView, { hubKeys, isHub, metadataForHub } from "@/components/curated/HubView";

export const dynamicParams = false;
export const generateStaticParams = () => hubKeys("type").map((type) => ({ type }));

type P = { params: { type: string } };
export const generateMetadata = ({ params }: P) => (isHub("type", params.type) ? metadataForHub("type", params.type, "us") : {});
export default function Page({ params }: P) {
  if (!isHub("type", params.type)) notFound();
  return <HubView kind="type" hubKey={params.type} market="us" />;
}
