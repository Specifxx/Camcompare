import GadgetView, { gadgetMetadata } from "@/components/curated/GadgetView";

export const metadata = gadgetMetadata("smart-glasses", "us");
export default function Page() {
  return <GadgetView type="smart-glasses" market="us" />;
}
