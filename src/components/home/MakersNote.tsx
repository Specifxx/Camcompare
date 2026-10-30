// A short note from the people who make the site, under the home page's
// hero. Plain text (owner, 2026-10-17: "no random shapes and graphics").
// OWNER: placeholder copy in your voice; personalise it freely, but keep it
// true. No invented facts, names or testimonials.
export default function MakersNote({ board, place }: { board: boolean; place: string }) {
  return (
    <p className="max-w-2xl text-sm leading-relaxed text-muted">
      {board ? (
        <>We built this to stop keeping 20 tabs open: what it cost new at launch, minus the cheapest one a shop has in stock today. Biggest saving on top.</>
      ) : (
        <>We don&apos;t have launch prices for {place} on enough of the catalog yet, so for now this page shows what the prices themselves say.</>
      )}{" "}
      Some links earn us a small commission; deals are still ranked by the saving alone.
    </p>
  );
}
