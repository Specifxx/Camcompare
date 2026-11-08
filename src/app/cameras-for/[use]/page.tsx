import { notFound } from "next/navigation";
import UseView, { isUse, USE_KEYS, metadataForUse } from "@/components/curated/UseView";

export const dynamicParams = false;
export const generateStaticParams = () => USE_KEYS.map((use) => ({ use }));

type P = { params: { use: string } };
export const generateMetadata = ({ params }: P) => (isUse(params.use) ? metadataForUse(params.use, "us") : {});
export default function Page({ params }: P) {
  if (!isUse(params.use)) notFound();
  return <UseView use={params.use} market="us" />;
}
