import UsedView, { usedMetadata } from "@/views/UsedView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => usedMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <UsedView market={marketParam(params)} />;
}
