import type { Metadata } from "next";
import SavedList from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Saved</h1>
      <SavedList market="us" />
    </div>
  );
}
