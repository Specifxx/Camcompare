import ReleasesView, { releasesMetadata } from "@/components/releases/ReleasesView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => releasesMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <ReleasesView market={marketParam(params)} />;
}
