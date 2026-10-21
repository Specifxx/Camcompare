import ReleasesView, { releasesMetadata } from "@/components/releases/ReleasesView";

// Static: rebuilt when a commit changes data/releases.json (with the prices). No revalidate.
export const metadata = releasesMetadata("us");
export default function Page() {
  return <ReleasesView market="us" />;
}
