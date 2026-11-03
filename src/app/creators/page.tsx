import type { Metadata } from "next";
import Link from "next/link";
import { CoffeeIcon, CreatorCard } from "@/components/creators/CreatorCard";
import { featuredCreators } from "@/lib/creators";
import { ldJson } from "@/lib/jsonld";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

// /creators: the camera creators hub, RiftCompare's /creators brought over (owner, 2026-11-03: "a really nice formatted
// creators page, just like how RiftCompare does it", on every site). Two audiences: photographers finding creators to
// follow and tip, and creators deciding whether a listing is worth a mention in their content. The list is static
// (src/lib/creators.ts), so the page is static like every page: no data read, no request read, no revalidate.

const TITLE = "Camera Creators: Follow & Buy Them a Coffee";
const DESCRIPTION =
  "The camera and photography creators we feature: gear reviews, lens comparisons, used-market advice and the shots that sell a camera. Follow them, and buy your favourite a coffee. Creators: get featured free.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/creators" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/creators`, siteName: SITE_NAME, type: "website" },
};

const FAQS: [string, string][] = [
  [
    "What does “Buy them a coffee” do?",
    `It opens the creator's own tip page (Ko-fi, Buy Me a Coffee, Patreon or similar). The money goes straight to them. ${SITE_NAME} never handles it and takes no cut.`,
  ],
  [
    "Does it cost anything to be featured?",
    `No. A listing is free. We ask featured creators to mention ${SITE_NAME} in their content, for example a link in a video description or a price check on screen, and we send our visitors their way in return.`,
  ],
  [
    "Who can apply?",
    "Anyone who makes camera or photography content regularly: YouTube, TikTok, Instagram, X, Threads, a podcast, a newsletter or a blog. Audience size matters less than making content photographers trust. A real person reviews every application.",
  ],
  [
    "Will I see how many clicks my listing sends?",
    "Yes. We count clicks on every featured creator's links and tip button, and share the numbers with them on request.",
  ],
];

// "How to work with us" (owner, 2026-11-01): flexible on purpose, any one of these is plenty. Creators call us their
// "partner" in their own content, not "sponsor": we don't pay them for a mention.
const WORK_WITH_US = [
  { title: "Link us", body: "Put camcompare.app in your bio, video description or a story link. That's the one thing that helps most." },
  { title: "Shout us out", body: `In the content you already make, a quick line: “check out our partner ${SITE_NAME}” while you review a body, compare two lenses or talk about buying used.` },
  { title: "Show how it works", body: "A short walkthrough or honest review: look up a camera, put two side by side, see the new and used prices at every store. Say what you really think." },
];

const PERKS = [
  { icon: "📣", title: "A spotlight card, free", body: "Your avatar, what you make and every channel you're on, here and in the creators bubble on our homepage." },
  { icon: "☕", title: "A “Buy them a coffee” button", body: "Straight to your own Ko-fi, Patreon or tip page. Fans support you directly; we never touch the money." },
  { icon: "📈", title: "Photographers about to buy, not random traffic", body: "People visit when they're choosing between two cameras or lenses and want the real price: the people who watch gear reviews." },
  { icon: "🤝", title: "Shout-outs and real numbers", body: "We share your new videos on our socials, and tell you how many clicks your listing sent you." },
];

const APPLY_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${SITE_NAME} creator feature`)}&body=${encodeURIComponent(
  "Hi! I make camera / photography content and I'd like to be featured.\n\nName / channel:\nWhat I make:\nLinks (YouTube, TikTok, Instagram, X, newsletter…):\nTip page (Ko-fi, Patreon…), if any:\nWhere I'm based:\n",
)}`;

export default function CreatorsPage() {
  const creators = featuredCreators();
  const openSpots = creators.length === 0 ? 3 : (3 - (creators.length % 3)) % 3 || 3;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Creators", item: `${SITE_URL}/creators` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${TITLE} | ${SITE_NAME}`,
      url: `${SITE_URL}/creators`,
      ...(creators.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              itemListElement: creators.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: { "@type": "Person", name: c.name, url: `${SITE_URL}/creators#${c.slug}`, sameAs: c.links.map((l) => l.url) },
              })),
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(ld)} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link prefetch={false} href="/" className="hover:text-fg">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg">Creators</span>
      </nav>

      {/* Hero */}
      <header className="card relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-azure/15 blur-3xl" />
        <div className="relative z-10 max-w-xl">
          <span className="eyebrow">✦ Creators</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
            Camera creators we <span className="text-gradient">love</span>
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            The people who make choosing a camera easier: honest gear reviews, lens comparisons, used-market advice and the shots that
            show what a body can really do. Watch them, follow them, and buy your favourite a coffee.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#featured" className="btn-primary min-h-11 px-5">
              Meet the creators
            </a>
            <a href="#apply" className="btn-ghost min-h-11 px-5">
              I make camera content →
            </a>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute right-8 top-6 hidden h-56 w-72 md:block">
          {["left-0 top-8 -rotate-[10deg] from-accent/40 to-accent-soft", "left-[88px] top-0 z-10 rotate-[2deg] from-azure/40 to-accent-soft", "left-[176px] top-10 rotate-[11deg] from-buy/30 to-buy-soft"].map((cls) => (
            <div key={cls} className={`absolute h-48 w-36 rounded-2xl border border-line bg-gradient-to-br shadow-card ${cls}`}>
              <div className="m-3 h-20 rounded-lg bg-surface/70" />
              <div className="mx-3 mt-3 h-2 w-20 rounded bg-surface/70" />
              <div className="mx-3 mt-2 h-2 w-12 rounded bg-surface/70" />
            </div>
          ))}
        </div>
      </header>

      {/* Featured creators */}
      <section id="featured" className="mt-10 scroll-mt-24">
        <h2 className="h-section">Featured creators</h2>
        <p className="mt-1 text-sm text-muted">
          {creators.length ? "Newest first. Tap a channel to follow, or buy them a coffee to say thanks." : "Our first creators are joining now. Want to be one of them?"}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c, i) => (
            <CreatorCard key={c.slug} creator={c} index={i} />
          ))}
          {/* Open spots fill the last row (a full row of three while the list is empty), so the grid reads as "join us" rather
              than a finished list. Never an invented creator. */}
          {Array.from({ length: openSpots }).map((_, i) => (
            <a key={`open-${i}`} href="#apply" className="group flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface/60 p-6 text-center no-underline transition hover:border-accent hover:bg-accent-soft/40 hover:no-underline">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-azure/30 text-3xl transition-transform group-hover:scale-110" aria-hidden>
                ✨
              </span>
              <span className="mt-4 font-display text-base font-bold text-fg">Your channel here</span>
              <span className="mt-1 max-w-[16rem] text-sm text-muted">Make camera content? Get a free spotlight card and a “Buy them a coffee” button.</span>
              <span className="mt-4 text-sm font-bold text-accent">Apply to be featured →</span>
            </a>
          ))}
        </div>
      </section>

      {/* How tipping works */}
      <section className="card mt-10 grid items-center gap-6 border-accent/30 bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:grid-cols-[auto,1fr] sm:p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-azure text-accent-fg shadow-card">
          <CoffeeIcon className="h-10 w-10" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Buy your favourite creator a coffee</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Every featured creator with a tip page gets a “Buy them a coffee” button. It goes straight to their own Ko-fi, Patreon or tip
            page, so <strong className="text-fg">100% of what you send goes to them</strong>. {SITE_NAME} never handles the money and takes
            no cut. It&rsquo;s the easiest way to say thanks for the review that saved you from the wrong lens.
          </p>
        </div>
      </section>

      {/* For creators */}
      <section id="apply" className="mt-10 scroll-mt-24">
        <h2 className="h-section">Make camera content? Let&rsquo;s grow together</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Mention {SITE_NAME} in your content (a link in your description, a price check on screen, a shout-out in a video) and we feature
          you here, free. Here&rsquo;s what you get.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {PERKS.map((p) => (
            <div key={p.title} className="card flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised text-xl" aria-hidden>
                {p.icon}
              </span>
              <div>
                <h3 className="font-bold">{p.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="card mt-5 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">Apply to be featured</h3>
            <p className="mt-1 text-sm text-muted">Email us your channel links and what you make. A real person replies, usually within a few days.</p>
          </div>
          <a href={APPLY_HREF} className="btn-primary min-h-11 shrink-0 px-5">
            Email us to get featured
          </a>
        </div>
      </section>

      {/* How to work with us */}
      <section id="work-with-us" className="mt-10 scroll-mt-24">
        <h2 className="h-section">How to work with us</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Creators often ask how we&rsquo;d like {SITE_NAME} promoted. Honestly, however suits you: no contract, no script, no quota and
          nothing to send us first. We help you, you help us, and we keep featuring you either way.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {WORK_WITH_US.map((w, i) => (
            <li key={w.title} className="card p-5">
              <span className="eyebrow">Option {i + 1}</span>
              <h3 className="mt-1 font-bold">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{w.body}</p>
            </li>
          ))}
        </ol>
        <div className="card mt-3 p-5">
          <h3 className="font-bold">Lines you can borrow</h3>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted">
            <li>“Prices checked on our partner camcompare.app. Link in my bio.”</li>
            <li>“Be sure to check out our partner {SITE_NAME}: it puts camera specs side by side and compares new and used prices across stores.”</li>
          </ul>
          <p className="mt-3 text-sm leading-6 text-muted">
            Please say we&rsquo;re partners (“our partner”, or your platform&rsquo;s partnership label) so your followers know. Ad rules such
            as the FTC&rsquo;s in the US and the ASA&rsquo;s in the UK ask for that even when no money changes hands.
          </p>
        </div>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="creators-faq">
        <h2 id="creators-faq" className="h-section">
          Creators FAQ
        </h2>
        <dl className="mt-4 space-y-5">
          {FAQS.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className="mt-1 text-sm leading-6 text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-10 text-sm text-muted">
        While you&rsquo;re here:{" "}
        <Link prefetch={false} href="/deals" className="font-semibold">
          see today&rsquo;s camera deals
        </Link>
        .
      </p>
    </div>
  );
}
