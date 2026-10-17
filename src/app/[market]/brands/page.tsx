import { BrandsIndex, brandsMetadata } from "@/views/BrandView";
import { marketParam } from "../market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => brandsMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <BrandsIndex market={marketParam(params)} />;
}
