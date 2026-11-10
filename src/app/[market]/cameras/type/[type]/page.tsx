import { notFound } from "next/navigation";
import HubView, { hubKeys, isHub, metadataForHub } from "@/components/curated/HubView";
import { marketParam } from "../../../market";

export const dynamicParams = false; // see ../../../page.tsx
export const generateStaticParams = () => hubKeys("type").map((type) => ({ type }));

type P = { params: { market: string; type: string } };
export const generateMetadata = ({ params }: P) => (isHub("type", params.type) ? metadataForHub("type", params.type, marketParam(params)) : {});
export default function Page({ params }: P) {
  if (!isHub("type", params.type)) notFound();
  return <HubView kind="type" hubKey={params.type} market={marketParam(params)} />;
}
