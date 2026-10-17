import BrowseView, { browseMetadata } from "@/views/BrowseView";
import { marketParam } from "../market";

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => browseMetadata("camera", marketParam(params));
export default function Page({ params }: P) {
  return <BrowseView kind="camera" market={marketParam(params)} />;
}
