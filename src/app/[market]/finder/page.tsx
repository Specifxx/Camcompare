import FinderView, { finderMetadata } from "@/views/FinderView";
import { marketParam } from "../market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => finderMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <FinderView market={marketParam(params)} />;
}
