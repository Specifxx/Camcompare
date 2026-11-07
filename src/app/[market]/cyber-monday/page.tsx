import DealsView, { cyberMondayMetadata } from "@/views/DealsView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => cyberMondayMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <DealsView market={marketParam(params)} cyberMonday />;
}
