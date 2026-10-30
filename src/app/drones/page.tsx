import GadgetView, { gadgetMetadata } from "@/components/curated/GadgetView";

export const metadata = gadgetMetadata("drone", "us");
export default function Page() {
  return <GadgetView type="drone" market="us" />;
}
