import { notFound } from "next/navigation";
import UseView, { isUse, USE_KEYS, metadataForUse } from "@/components/curated/UseView";
import { marketParam } from "../../market";

export const dynamicParams = false; // see ../../page.tsx
export const generateStaticParams = () => USE_KEYS.map((use) => ({ use }));

type P = { params: { market: string; use: string } };
export const generateMetadata = ({ params }: P) => (isUse(params.use) ? metadataForUse(params.use, marketParam(params)) : {});
export default function Page({ params }: P) {
  if (!isUse(params.use)) notFound();
  return <UseView use={params.use} market={marketParam(params)} />;
}
