import CompareView, { compareMetadata } from "@/views/CompareView";

// Reads ?c=, so it renders per request (it is noindex anyway).
export const dynamic = "force-dynamic";
export const metadata = compareMetadata("us");
export default function Page({ searchParams }: { searchParams: { c?: string } }) {
  return <CompareView market="us" c={searchParams.c} />;
}
