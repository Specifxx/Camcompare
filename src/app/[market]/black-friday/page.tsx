import DealsView, { blackFridayMetadata } from "@/views/DealsView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => blackFridayMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <DealsView market={marketParam(params)} blackFriday />;
}
