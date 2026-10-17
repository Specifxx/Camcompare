// A note from the people who make the site, pinned to the top of the home
// page. OWNER: this is placeholder copy written in your voice; personalise it
// freely (a first name, why you started it), but keep it true. No invented
// facts, names or testimonials.
import Link from "next/link";

export default function MakersNote({ board, place }: { board: boolean; place: string }) {
  return (
    <aside aria-label="A note from us" className="hd-letter">
      <p className="cc-hand text-[1.45rem] leading-none text-accent sm:text-[1.6rem]">Hi, a quick word from us</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We built this because we were sick of having 20 tabs open just to work out what a used lens really goes for.{" "}
        {board ? (
          <>So this page does the sum we kept doing by hand: what it cost new at launch, minus the cheapest used one a shop actually has in stock today. Biggest saving on top.</>
        ) : (
          <>
            The plan is to do the sum we kept doing by hand: launch price minus the cheapest used one in stock. We don&apos;t have launch prices for {place} on enough of the catalog yet, so for now it&apos;s what the
            prices themselves say.
          </>
        )}{" "}
        Some links earn us a small commission; that never changes the order.
      </p>
      <p className="mt-2 text-sm text-muted">
        Spotted a wrong price, or a shop we should be checking?{" "}
        <Link href="/feedback" prefetch={false} className="font-semibold">
          Tell us
        </Link>
        . It comes straight to us.
      </p>
    </aside>
  );
}
