import DigicamsView, { digicamsMetadata } from "@/components/curated/DigicamsView";

export const metadata = digicamsMetadata("us");
export default function Page() {
  return <DigicamsView market="us" />;
}
