import CompareView, { compareMetadata } from "@/views/CompareView";
import { marketParam } from "../market";

// Reads ?c=, so it renders per request (it is noindex anyway).
export const dynamic = "force-dynamic";
type P = { params: { market: string }; searchParams: { c?: string } };
export const generateMetadata = ({ params }: P) => compareMetadata(marketParam(params));
export default function Page({ params, searchParams }: P) {
  return <CompareView market={marketParam(params)} c={searchParams.c} />;
}
