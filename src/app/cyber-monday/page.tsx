import DealsView, { cyberMondayMetadata } from "@/views/DealsView";

export const metadata = cyberMondayMetadata("us");
export default function Page() {
  return <DealsView market="us" cyberMonday />;
}
