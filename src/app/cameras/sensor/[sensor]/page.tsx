import { notFound } from "next/navigation";
import HubView, { hubKeys, isHub, metadataForHub } from "@/components/curated/HubView";

export const dynamicParams = false;
export const generateStaticParams = () => hubKeys("sensor").map((sensor) => ({ sensor }));

type P = { params: { sensor: string } };
export const generateMetadata = ({ params }: P) => (isHub("sensor", params.sensor) ? metadataForHub("sensor", params.sensor, "us") : {});
export default function Page({ params }: P) {
  if (!isHub("sensor", params.sensor)) notFound();
  return <HubView kind="sensor" hubKey={params.sensor} market="us" />;
}
