"use client";
// Members' comments on a product, loaded only once the reader scrolls near
// them (as community/Discussion does), so most visits never call the API.
import { useRef } from "react";
import Comments from "@/components/community/Comments";
import { useNearViewport } from "@/components/community/client";

export default function DeferredComments({ target }: { target: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  return <div ref={ref}>{near ? <Comments target={target} /> : <p className="text-sm text-muted">Loading comments…</p>}</div>;
}
