import { MountsIndex, mountsMetadata } from "@/views/MountView";

export const metadata = mountsMetadata("us");
export default function Page() {
  return <MountsIndex market="us" />;
}
