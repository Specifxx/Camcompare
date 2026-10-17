import { notFound } from "next/navigation";
import { accessoryCategory } from "@/lib/accessories";
import { AccessoryCategoryView, accessoryCategoryMetadata, accessoryCategoryParams } from "@/views/AccessoriesView";
import { marketParam } from "../../market";

export const dynamicParams = false;
export const generateStaticParams = accessoryCategoryParams;

type P = { params: { market: string; category: string } };
export const generateMetadata = ({ params }: P) => accessoryCategoryMetadata(params.category, marketParam(params));
export default function Page({ params }: P) {
  const m = marketParam(params);
  if (!accessoryCategory(params.category)) notFound();
  return <AccessoryCategoryView category={params.category} market={m} />;
}
