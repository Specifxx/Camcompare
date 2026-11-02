import DealsView, { saleMetadata } from "@/views/DealsView";

export const metadata = saleMetadata("boxing-day", "us");
export default function Page() {
  return <DealsView market="us" sale="boxing-day" />;
}
