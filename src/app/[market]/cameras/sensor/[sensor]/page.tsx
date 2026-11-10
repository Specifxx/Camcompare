import { notFound } from "next/navigation";
import HubView, { hubKeys, isHub, metadataForHub } from "@/components/curated/HubView";
import { marketParam } from "../../../market";

export const dynamicParams = false; // see ../../../page.tsx
export const generateStaticParams = () => hubKeys("sensor").map((sensor) => ({ sensor }));

type P = { params: { market: string; sensor: string } };
export const generateMetadata = ({ params }: P) => (isHub("sensor", params.sensor) ? metadataForHub("sensor", params.sensor, marketParam(params)) : {});
export default function Page({ params }: P) {
  if (!isHub("sensor", params.sensor)) notFound();
  return <HubView kind="sensor" hubKey={params.sensor} market={marketParam(params)} />;
}
