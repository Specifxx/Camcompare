import AccessoriesView, { accessoriesMetadata } from "@/views/AccessoriesView";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => accessoriesMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <AccessoriesView market={marketParam(params)} />;
}
