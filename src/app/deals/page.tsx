import DealsView, { dealsMetadata } from "@/views/DealsView";

export const metadata = dealsMetadata("us");
export default function Page() {
  return <DealsView market="us" />;
}
