// Which makers "Just announced" watches, and where (owner, 2026-10-21: "follow
// all the company pages and check all the time for new announcements").
// Client-safe data: the brand-alert picker lists RELEASE_BRANDS.
//
// Every feed here was fetched by hand on 2026-10-21 and answered 200 with
// recent entries. `via` says how we know a channel is the maker's own:
//   "site"   the maker's own website links to it (strongest);
//   "search" YouTube's channel search, the maker's name, the largest channel
//            of that name, posting that maker's launches (checked by eye).
// Channels that resolved but were dead or not the maker's were dropped (see
// DECISIONS.md, 2026-10-21 "Just announced").
//
// `brand` is the catalog brand slug where the catalog has one, so a release
// can link the brand page and alerts can name it.

export type FeedSource =
  /** `only` (both kinds): keep items whose title matches, for a maker that is mostly something else (Apple, Samsung, Panasonic). */
  | { type: "youtube"; channelId: string; label: string; via: "site" | "search"; only?: string }
  /** An official newsroom RSS/Atom feed. */
  | { type: "rss"; url: string; label: string; via: "site"; only?: string };

/** `catalog`: the catalog brand whose products its releases can name, when not `key` (Fujinon lenses are Fujifilm's). */
export type ReleaseBrand = { key: string; name: string; group: BrandGroup; feeds: FeedSource[]; catalog?: string };

export const BRAND_GROUPS = ["Cameras and lenses", "Video gear", "Rigs, support and lighting", "Audio"] as const;
export type BrandGroup = (typeof BRAND_GROUPS)[number];

const yt = (channelId: string, label: string, via: "site" | "search" = "search", only?: string): FeedSource => ({ type: "youtube", channelId, label, via, ...(only ? { only } : {}) });
const rss = (url: string, label: string, only?: string): FeedSource => ({ type: "rss", url, label, via: "site", ...(only ? { only } : {}) });

const C = "Cameras and lenses";
const V = "Video gear";
const R = "Rigs, support and lighting";
const A = "Audio";

export const RELEASE_BRANDS: ReleaseBrand[] = [
  // ---- cameras and lenses
  { key: "canon", name: "Canon", group: C, feeds: [yt("UCvqs9r3h9dh87lRHSatDpNg", "Canon USA"), yt("UCdBQyug-E_cYaBJA3OxGyNA", "Canon Europe")] },
  { key: "sony", name: "Sony", group: C, feeds: [yt("UC7McIsZ7v-RdLedtk6d6zRg", "Sony | Camera Channel", "site"), yt("UCgHj6wKL5qrtaqB3VKo3dYQ", "Sony Alpha Universe", "site")] },
  { key: "fujifilm", name: "Fujifilm", group: C, feeds: [yt("UCZvtcRxo82A4-7BQ2T8MOAA", "FUJIFILM X Series", "site"), yt("UCXuESiygqNaA-TXZIZXBxPg", "FUJIFILMglobal")] },
  { key: "fujinon", name: "Fujinon", group: C, catalog: "fujifilm", feeds: [yt("UCrBGFx4Rgo37agSChWlfOIA", "FUJIFILM Americas (Fujinon)", "site")] },
  { key: "nikon", name: "Nikon", group: C, feeds: [yt("UCjmEbz8wosl__h2opGT5k2w", "Nikon USA"), yt("UCvjCGQqOuBAILkxVAoGMlBw", "Nikon Europe"), rss("https://www.nikon.com/company/rss/feeds/imaging.rss", "Nikon imaging news")] },
  { key: "hasselblad", name: "Hasselblad", group: C, feeds: [yt("UC8k0m7iO0s-aLkVnh9r9VCg", "Hasselblad")] },
  { key: "leica", name: "Leica", group: C, feeds: [yt("UCVmgQawOcdeA9v9o0aukV7A", "Leica Camera")] },
  { key: "sigma", name: "Sigma", group: C, feeds: [yt("UCB0JW9gFBGczQ0RmkkDVhwQ", "SIGMA")] },
  { key: "om-system", name: "OM System (Olympus)", group: C, feeds: [yt("UCOEymkD9VnWM5dZHj08EZVA", "OM SYSTEM Cameras", "site")] },
  { key: "panasonic", name: "Panasonic Lumix", group: C, feeds: [yt("UCxSt5kmZG3dNXsBJqtzIKmQ", "LUMIX"), rss("https://news.panasonic.com/global/rss/category/products-solutions/electronics.xml", "Panasonic Newsroom", "lumix|camera|lens")] },
  { key: "ricoh", name: "Ricoh / Pentax", group: C, feeds: [yt("UCD_djFZ1d24FKaUM237yjew", "RICOH IMAGING"), rss("https://us.ricoh-imaging.com/feed/", "Ricoh Imaging Americas news")] },
  { key: "tamron", name: "Tamron", group: C, feeds: [yt("UCJxB6B6hAEPZtSj_DqxEgaQ", "TAMRON Japan", "site"), yt("UCddJ3JeJcNrOhevyLLixHgQ", "Tamron Europe")] },
  { key: "zeiss", name: "Zeiss", group: C, feeds: [yt("UC6t7IQyBM77KVoCUPfuveOA", "ZEISS Camera Lenses"), yt("UCdApvEh_En_kEP7-tyoPYtw", "ZEISS Cinematography")] },
  { key: "viltrox", name: "Viltrox", group: C, feeds: [yt("UCuxYiOaEKhjzNiLibedo24Q", "Viltrox Official", "site")] },
  { key: "samyang", name: "Samyang", group: C, feeds: [yt("UCJUhH8nOoZ26flxew8RJBPA", "Samyang Lens")] },
  { key: "kodak", name: "Kodak", group: C, feeds: [yt("UC0Q3HxbEw4ZcPYnfXrepkjw", "Kodak", "site"), yt("UC8T6uG9qaM4xW4GbiXetuJw", "Eastman Kodak", "site")] },
  { key: "dzo", name: "DZOFilm", group: C, feeds: [yt("UC8Cndtgz0OGPG_A1mfNuPpA", "DZOFILM")] },
  { key: "cooke", name: "Cooke", group: C, feeds: [yt("UC-Ya9gBlwOhRwtloTn1hvbA", "Cooke Optics", "site")] },
  { key: "arri", name: "ARRI", group: C, feeds: [yt("UCtdsiPRhmJoOrhvnFOyVxeQ", "ARRI", "site")] },
  { key: "red", name: "RED", group: C, feeds: [yt("UCbgqb0ODUGP0APcPGVxh-fg", "RED Digital Cinema", "site")] },
  { key: "blackmagic", name: "Blackmagic Design", group: C, feeds: [yt("UCufB8sMVyP9JEScMjLz74YA", "Blackmagic Design", "site")] },
  { key: "samsung", name: "Samsung", group: C, feeds: [yt("UCWwgaK7x0_FR1goeSRazfsQ", "Samsung", "search", "camera|galaxy s\\d|galaxy z|unpacked")] },
  { key: "apple", name: "Apple", group: C, feeds: [yt("UCE_M8A5yxnLfW0KghEeajjw", "Apple", "site", "iphone|camera"), rss("https://www.apple.com/newsroom/rss-feed.rss", "Apple Newsroom", "iphone|camera")] },
  // ---- video gear
  { key: "dji", name: "DJI", group: V, feeds: [yt("UCsNGtpqGsyw0U6qEG-WHadA", "DJI", "site")] },
  { key: "gopro", name: "GoPro", group: V, feeds: [yt("UCqhnX4jA0A5paNd1v-zEysw", "GoPro")] },
  { key: "insta360", name: "Insta360", group: V, feeds: [yt("UC3qWcF49rv8VMZO7Vg6kj5w", "Insta360")] },
  { key: "atomos", name: "Atomos", group: V, feeds: [yt("UCGlDF0dNjKJnZPYviPXCj6Q", "ATOMOS")] },
  { key: "teradek", name: "Teradek", group: V, feeds: [yt("UCENHoPrk5n39z1HzvpOuNaQ", "Teradek")] },
  { key: "hollyland", name: "Hollyland", group: V, feeds: [yt("UClAx1jeRVieI7oT049gczVA", "Hollyland Technology", "site"), rss("https://www.hollyland.com/feed", "Hollyland news")] },
  { key: "smallhd", name: "SmallHD", group: V, feeds: [yt("UCU7ExGoX7S-g74PWxQMnz9A", "SmallHD", "site")] },
  // ---- rigs, support and lighting
  { key: "kondor-blue", name: "Kondor Blue", group: R, feeds: [yt("UCZwp0jD711IMFKHSBProENQ", "KONDOR BLUE", "site")] },
  { key: "smallrig", name: "SmallRig", group: R, feeds: [yt("UCGVwRkDLlUpocQ1VnhjyzPA", "SmallRig", "site")] },
  { key: "tilta", name: "Tilta", group: R, feeds: [yt("UCm4TJjV659kTjeCfTjejjNw", "TILTA")] },
  { key: "ulanzi", name: "Ulanzi", group: R, feeds: [yt("UC-Jmw9-Jcq7lCuK-8t7_kiA", "Ulanzi", "site")] },
  { key: "sachtler", name: "Sachtler", group: R, feeds: [yt("UC4AEq17mCv1TV4MPuFqnajA", "Sachtler", "site")] },
  { key: "godox", name: "Godox", group: R, feeds: [yt("UCceuo1ZdHsxegsoa4Hgn55g", "GODOX Global", "site")] },
  { key: "aputure", name: "Aputure", group: R, feeds: [yt("UCc0D1yh3TGE8dJSLm9VmEdg", "Aputure", "site")] },
  { key: "neewer", name: "Neewer", group: R, feeds: [yt("UCwuqQrftRRMsSEQSZ8Fuldg", "Neewer Official", "site")] },
  { key: "profoto", name: "Profoto", group: R, feeds: [yt("UCG_lWnx3xTDIAW93Zq309Kg", "Profoto")] },
  { key: "broncolor", name: "Broncolor", group: R, feeds: [yt("UCaRLtwTshWcw1JChMVQn6IA", "broncolor", "site")] },
  // ---- audio
  { key: "rode", name: "RØDE", group: A, feeds: [yt("UCoAPdsREDWIFzJ2aZpJQlew", "RØDE", "site")] },
  { key: "sennheiser", name: "Sennheiser", group: A, feeds: [yt("UCiKPFvWsJBlucrYU8kJMkaQ", "Sennheiser", "site")] },
  { key: "shure", name: "Shure", group: A, feeds: [yt("UCHoc6CQjkHQjWx49Zms7Rxg", "Shure", "site")] },
  { key: "neumann", name: "Neumann", group: A, feeds: [yt("UCtmflCQi3wpzbyLARhzlPdw", "Neumann", "site")] },
];

/**
 * Brands the owner asked for that have no feed we could verify (2026-10-21):
 * AKG's site answers 403 and no official channel turned up; Bronica is a
 * dormant Tamron brand with no channel of its own. Not offered in the picker:
 * an alert for them would never fire.
 */
export const UNWATCHED_BRANDS = ["AKG", "Bronica"] as const;

const BY_KEY = new Map(RELEASE_BRANDS.map((b) => [b.key, b]));
export const releaseBrand = (key: string) => BY_KEY.get(key) ?? null;
export const releaseBrandName = (key: string) => BY_KEY.get(key)?.name ?? key;
export const isReleaseBrand = (key: unknown): key is string => typeof key === "string" && BY_KEY.has(key);
