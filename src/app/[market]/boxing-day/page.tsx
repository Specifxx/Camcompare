import DealsView, { saleMetadata } from "@/views/DealsView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => saleMetadata("boxing-day", marketParam(params));
export default function Page({ params }: P) {
  return <DealsView market={marketParam(params)} sale="boxing-day" />;
}
