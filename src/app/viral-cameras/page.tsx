import ViralView, { viralMetadata } from "@/components/curated/ViralView";

export const metadata = viralMetadata("us");
export default function Page() {
  return <ViralView market="us" />;
}
