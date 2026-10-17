import BoardView, { boardMetadata } from "@/views/BoardView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => boardMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <BoardView market={marketParam(params)} />;
}
