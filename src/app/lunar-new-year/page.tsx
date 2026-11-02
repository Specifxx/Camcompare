import DealsView, { saleMetadata } from "@/views/DealsView";

export const metadata = saleMetadata("lunar-new-year", "us");
export default function Page() {
  return <DealsView market="us" sale="lunar-new-year" />;
}
