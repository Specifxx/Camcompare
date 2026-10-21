import ViralView, { viralMetadata } from "@/components/curated/ViralView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => viralMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <ViralView market={marketParam(params)} />;
}
