import DealsView, { saleMetadata } from "@/views/DealsView";

export const metadata = saleMetadata("january-sales", "us");
export default function Page() {
  return <DealsView market="us" sale="january-sales" />;
}
