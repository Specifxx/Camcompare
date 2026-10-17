import { MountsIndex, mountsMetadata } from "@/views/MountView";
import { marketParam } from "../market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => mountsMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <MountsIndex market={marketParam(params)} />;
}
