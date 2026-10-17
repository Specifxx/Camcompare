import AccessoriesView, { accessoriesMetadata } from "@/views/AccessoriesView";

export const metadata = accessoriesMetadata("us");
export default function Page() {
  return <AccessoriesView market="us" />;
}
