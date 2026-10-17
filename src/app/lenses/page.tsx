import BrowseView, { browseMetadata } from "@/views/BrowseView";

export const metadata = browseMetadata("lens", "us");
export default function Page() {
  return <BrowseView kind="lens" market="us" />;
}
