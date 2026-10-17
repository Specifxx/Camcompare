import type { Metadata } from "next";
import SavedList from "@/components/SavedList";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };
export default function Page({ params }: { params: { market: string } }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Saved</h1>
      <SavedList market={marketParam(params)} />
    </div>
  );
}
