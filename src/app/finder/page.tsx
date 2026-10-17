import FinderView, { finderMetadata } from "@/views/FinderView";

export const metadata = finderMetadata("us");
export default function Page() {
  return <FinderView market="us" />;
}
