import UsedView, { usedMetadata } from "@/views/UsedView";

export const metadata = usedMetadata("us");
export default function Page() {
  return <UsedView market="us" />;
}
