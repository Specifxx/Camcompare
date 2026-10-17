import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CameraThumb from "@/components/CameraThumb";
import OffersTable from "@/components/OffersTable";
import PriceHistory from "@/components/PriceHistory";
import { brandName, camera, credit, historyFor, mount, offersFor, pairSlug, publishedCameras, rivalsOf } from "@/lib/catalog";
import type { Camera } from "@/lib/catalog/schema";
import { centsToUsd, usdWhole } from "@/lib/format";
import { breadcrumb, ldJson, productLd } from "@/lib/jsonld";
import { lowest } from "@/lib/offers";

import { SPEC_GROUPS, lensLabel, sensorLabel, typeLabel } from "@/lib/specs/definitions";

export const dynamicParams = false;

// Static: the catalog is files in the repo, so prerendering every camera
// reads no database (RiftCompare's rule against generateStaticParams is about
// DB-backed routes).
export function generateStaticParams() {
  return publishedCameras().map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = camera(params.slug);
  if (!c) return {};
  const n = lowest(offersFor(c.slug), "new");
  const u = lowest(offersFor(c.slug), "used");
  const price = n ? ` New from ${centsToUsd(n.priceCents)}${u ? `, used from ${centsToUsd(u.priceCents)}` : ""}.` : u ? ` Used from ${centsToUsd(u.priceCents)}.` : "";
  return {
    title: `${c.name} price & specs`,
    description: `${c.name}: ${c.specs.megapixels} MP ${sensorLabel(c.specs.sensorFormat).toLowerCase()} ${typeLabel(c.type).toLowerCase()}, announced ${c.announced.slice(0, 4)}.${price} Full specs and side-by-side comparisons.`,
    alternates: { canonical: `/cameras/${c.slug}` },
    openGraph: { title: `${c.name} price & specs`, url: `/cameras/${c.slug}`, images: [`/cameras/${c.slug}.webp`] },
  };
}

function KeySpecs({ c }: { c: Camera }) {
  const s = c.specs;
  const items = [
    `${sensorLabel(s.sensorFormat)} sensor`,
    `${s.megapixels} MP`,
    s.ibis ? `IBIS${s.ibisStops ? ` ${s.ibisStops} stops` : ""}` : null,
    s.videoMaxRes ? `${s.videoMaxRes} video${s.video4kMaxFps ? ` · 4K${s.video4kMaxFps}` : ""}` : null,
    s.burstElecFps || s.burstMechFps ? `${Math.max(s.burstElecFps ?? 0, s.burstMechFps ?? 0)} fps` : null,
    s.weightG ? `${s.weightG} g` : null,
    s.weatherSealed ? "Weather sealed" : null,
    lensLabel(c),
  ].filter(Boolean);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => <li key={t} className="chip">{t}</li>)}
    </ul>
  );
}

export default function CameraPage({ params }: { params: { slug: string } }) {
  const c = camera(params.slug);
  if (!c) notFound();
  const offers = offersFor(c.slug);
  const n = lowest(offers, "new");
  const u = lowest(offers, "used");
  const cr = credit(c.slug);
  const m = c.mount ? mount(c.mount) : null;
  const rivals = rivalsOf(c);
  const family = [c.predecessor, c.successor].map((s) => (s ? camera(s) : null)).filter((x): x is Camera => x !== null);
  const page = `cam-${c.slug}`;
  return (
    <article className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd(c, offers))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Cameras", path: "/cameras" }, { name: brandName(c.brand), path: `/brands/${c.brand}` }, { name: c.name, path: `/cameras/${c.slug}` }]))} />
      <nav className="text-xs text-subtle">
        <Link href="/cameras">Cameras</Link> / <Link href={`/brands/${c.brand}`}>{brandName(c.brand)}</Link> / <span>{c.shortName}</span>
      </nav>

      <header className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
        <figure>
          <CameraThumb slug={c.slug} alt={`${c.name}`} priority className="border border-line" />
          {cr && (
            <figcaption className="mt-1 text-[11px] text-subtle">
              Photo: {cr.author}, <a href={cr.pageUrl} rel="nofollow noopener" target="_blank">{cr.license}</a>
            </figcaption>
          )}
        </figure>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{c.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {typeLabel(c.type)} · {m ? m.name : "Fixed lens"} · Announced {new Date(c.announced + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
              {c.status === "discontinued" ? " · Discontinued (new stock may be limited)" : ""}
            </p>
          </div>
          <KeySpecs c={c} />
          {n || u ? (
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="card p-3">
                <p className="text-xs text-subtle">Lowest new</p>
                <p className="price text-xl font-bold text-buy">{n ? centsToUsd(n.priceCents) : "—"}</p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-subtle">Lowest used</p>
                <p className="price text-xl font-bold">{u ? centsToUsd(u.priceCents) : "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Not priced yet: <a href="#prices">check it at the retailers below</a>.
            </p>
          )}
          {c.launchPriceUsd && <p className="text-xs text-subtle">Launch price {usdWhole(c.launchPriceUsd)} (body only).</p>}
        </div>
      </header>

      <section id="prices">
        <h2 className="h-section mb-3">Where to buy the {c.shortName}</h2>
        <OffersTable camera={c} offers={offers} page={page} />
      </section>

      <section>
        <h2 className="h-section mb-3">Price history</h2>
        <div className="card p-4"><PriceHistory points={historyFor(c.slug)} /></div>
      </section>

      {(rivals.length > 0 || family.length > 0) && (
        <section>
          <h2 className="h-section mb-3">Compare the {c.shortName}</h2>
          <div className="flex flex-wrap gap-2">
            {[...family, ...rivals].filter((x, i, arr) => arr.findIndex((y) => y.slug === x.slug) === i).map((r) => (
              <Link key={r.slug} href={rivals.includes(r) ? `/compare/${pairSlug(c, r)}` : `/compare?c=${c.slug},${r.slug}`} className="btn-ghost">
                vs {r.name}
                {r.slug === c.predecessor ? <span className="text-xs font-normal text-subtle">(predecessor)</span> : r.slug === c.successor ? <span className="text-xs font-normal text-subtle">(successor)</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="h-section mb-3">{c.shortName} specifications</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {SPEC_GROUPS.map((g) => (
            <div key={g.id} className="card overflow-hidden">
              <h3 className="bg-raised px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{g.title}</h3>
              <dl className="divide-y divide-line text-sm">
                {g.specs.map((d) => (
                  <div key={d.key} className="grid grid-cols-[45%_1fr] gap-2 px-4 py-2">
                    <dt className="text-muted">{d.label}</dt>
                    <dd>{d.format(c) ?? <span className="text-subtle">—</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
