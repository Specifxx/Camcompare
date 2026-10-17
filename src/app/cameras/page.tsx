import BrowseView, { browseMetadata } from "@/views/BrowseView";

export const metadata = browseMetadata("camera", "us");
export default function Page() {
  return <BrowseView kind="camera" market="us" />;
}
