import GadgetView, { gadgetMetadata } from "@/components/curated/GadgetView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => gadgetMetadata("drone", marketParam(params));
export default function Page({ params }: P) {
  return <GadgetView type="drone" market={marketParam(params)} />;
}
