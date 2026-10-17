import { MountsIndex, mountsMetadata } from "@/views/MountView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => mountsMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <MountsIndex market={marketParam(params)} />;
}
