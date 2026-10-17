import DealsView, { dealsMetadata } from "@/views/DealsView";
import { marketParam } from "../market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => dealsMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <DealsView market={marketParam(params)} />;
}
