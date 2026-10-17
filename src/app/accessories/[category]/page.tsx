import { notFound } from "next/navigation";
import { accessoryCategory } from "@/lib/accessories";
import { AccessoryCategoryView, accessoryCategoryMetadata, accessoryCategoryParams } from "@/views/AccessoriesView";

export const dynamicParams = false;
export const generateStaticParams = accessoryCategoryParams;

type P = { params: { category: string } };
export const generateMetadata = ({ params }: P) => accessoryCategoryMetadata(params.category, "us");
export default function Page({ params }: P) {
  if (!accessoryCategory(params.category)) notFound();
  return <AccessoryCategoryView category={params.category} market="us" />;
}
