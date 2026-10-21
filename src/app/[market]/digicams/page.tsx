import DigicamsView, { digicamsMetadata } from "@/components/curated/DigicamsView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => digicamsMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <DigicamsView market={marketParam(params)} />;
}
