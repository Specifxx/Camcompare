import type { Metadata } from "next";
import SavedList from "@/components/SavedList";
import { marketParam } from "../market";

export const dynamicParams = false; // see ../page.tsx

export const generateMetadata = ({ params }: { params: { market: string } }): Metadata => ({ title: "Saved", robots: { index: false, follow: false }, alternates: { canonical: `/${marketParam(params)}/saved` } });
export default function Page({ params }: { params: { market: string } }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Saved</h1>
      <SavedList market={marketParam(params)} />
    </div>
  );
}
