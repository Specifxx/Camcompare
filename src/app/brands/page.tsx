import { BrandsIndex, brandsMetadata } from "@/views/BrandView";

export const metadata = brandsMetadata("us");
export default function Page() {
  return <BrandsIndex market="us" />;
}
