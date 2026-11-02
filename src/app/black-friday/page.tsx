import DealsView, { blackFridayMetadata } from "@/views/DealsView";

export const metadata = blackFridayMetadata("us");
export default function Page() {
  return <DealsView market="us" blackFriday />;
}
