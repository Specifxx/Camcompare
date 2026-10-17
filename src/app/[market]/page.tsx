import HomeView, { homeMetadata } from "@/views/HomeView";
import { marketParam } from "./market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => homeMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <HomeView market={marketParam(params)} />;
}
