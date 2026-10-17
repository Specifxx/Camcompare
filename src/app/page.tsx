import HomeView, { homeMetadata } from "@/views/HomeView";

export const metadata = homeMetadata("us");
export default function Page() {
  return <HomeView market="us" />;
}
