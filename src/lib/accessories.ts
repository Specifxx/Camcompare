// Camera accessories (owner, 2026-10-17: "camera rigs and cages … film or
// tripods … compare the prices of different accessory brands").
//
// No new scraping: these are listings the Shopify and structured-data sources
// already download and that `matchListing` refuses (or never matches) because
// they are not a camera or a lens. `classifyAccessory` reads such a title and
// says what it is (a category), who makes it (an accessory brand, null when
// unknown), which catalog cameras it names (only with the camera's brand
// named, or made by that brand), the camera systems it is for, and the specs
// buyers compare on (capacity and speed for cards and drives, connector and
// speed for cables, TTL system for flashes and triggers).
//
// Like matching.ts it is one-way: anything doubtful is refused rather than
// filed under the wrong category. Nothing here changes what counts as a
// camera or lens offer. Pure: no files, no network (tests drive it directly).
import { z } from "zod";
import { BRAND_WORDS, compact, launchIn, tokens, type CatalogIndex, type Matchable } from "./matching";
import { CURRENCIES, refRate, type Currency } from "./markets";
import { CONDITIONS, type Condition } from "./retailers";

// ---------------------------------------------------------------- categories

export type CategoryGroup = "support" | "power" | "carry" | "media" | "light" | "audio" | "lens" | "other";

export type AccessoryCategoryDef = {
  slug: string;
  label: string; // "Cages & rigs"
  one: string; // "cage" (singular, for "cheapest cage")
  group: CategoryGroup;
  /** Tested in order against the lowercased title; the first category that matches wins. */
  re: RegExp;
  /** Most expensive believable listing, in USD at reference rates: a refuse-only sanity cap. */
  maxUsd: number;
  /** Shown on a camera page's accessories block, in this order (lower first). */
  cameraRank?: number;
};

// Order matters: the first match wins ("battery grip" is a grip, not a
// battery; "screen protector film" is no film; "gimbal head" is a tripod head).
export const CATEGORIES: AccessoryCategoryDef[] = [
  { slug: "screen-protectors", label: "Screen protectors", one: "screen protector", group: "other", maxUsd: 80, cameraRank: 5, re: /\b(screen|lcd|display)\s*(protectors?|guard|protection|film)\b|\btempered glass\b|\bglass protector\b/ },
  { slug: "cables", label: "Cables", one: "cable", group: "media", maxUsd: 300, re: /\b(hdmi|usb|usb-c|type-c|thunderbolt|sdi|lightning)\b[^,()]*\b(cable|cord|lead)\b|\b(cable|cord)\b[^,()]*\b(hdmi|usb-c|type-c|thunderbolt|sdi)\b/ },
  { slug: "memory-cards", label: "Memory cards", one: "memory card", group: "media", maxUsd: 2500, re: /\b(cfexpress|cf express|xqd|cfast|compactflash|compact flash|microsdxc|microsdhc|microsd|micro sd|sdxc|sdhc|sduc|memory card)\b|\bsd\b[^,()]*\b(card|\d+\s?gb|\d+\s?tb)\b|\bcf card\b/ },
  { slug: "storage", label: "SSDs & drives", one: "drive", group: "media", maxUsd: 5000, re: /\b(ssd|ssds|nvme|m\.2|hard drive|hard disk|hdd|portable drive|external drive|card reader|memory card reader|media reader|master caddy|ssd mini)\b/ },
  { slug: "film", label: "Film", one: "film", group: "media", maxUsd: 400, re: /$^/ /* decided by isFilmStock */ },
  { slug: "cages", label: "Cages & rigs", one: "cage", group: "support", maxUsd: 2500, cameraRank: 0, re: /\b(cage|cages|half cage|camera rig|shoulder rig|rig kit|rig|top handle|side handle|follow focus|matte box|rod clamp|rod rig|nato rail|nato clamp|cheese plate|magic arm|articulating arm|super clamp)\b/ },
  { slug: "plates", label: "L-brackets & plates", one: "plate", group: "support", maxUsd: 500, cameraRank: 3, re: /\b(l[- ]?bracket|l[- ]?plate|l[- ]?shape(d)? (bracket|plate)|quick[- ]release plate|qr plate|arca[- ]?(swiss)?([- ]type)?( compatible)? plate|base ?plate|camera plate|mounting plate|quick[- ]release|tripod (collar|foot|ring|mount ring)|lens (collar|foot|support))\b/ },
  { slug: "monopods", label: "Monopods", one: "monopod", group: "support", maxUsd: 1500, re: /\bmonopods?\b/ },
  { slug: "tripods", label: "Tripods & heads", one: "tripod", group: "support", maxUsd: 4000, re: /\b(tripods?|ball ?head|fluid head|pan[- ]?head|gimbal head|geared head|tripod head|pan[- ]tilt head|tabletop stand|gorillapod|travel tripod)\b/ },
  { slug: "gimbals", label: "Gimbals & stabilizers", one: "gimbal", group: "support", maxUsd: 2500, re: /\b(gimbals?|stabili[sz]ers?|steadicam)\b/ },
  { slug: "grips", label: "Battery grips & hand grips", one: "grip", group: "power", maxUsd: 900, cameraRank: 2, re: /\b(battery grip|vertical grip|hand ?grip|camera grip|power grip|shooting grip|grip extension|extension grip|metal grip|grip)\b/ },
  { slug: "chargers", label: "Chargers & power", one: "charger", group: "power", maxUsd: 500, cameraRank: 4, re: /\b(battery chargers?|chargers?|charging (dock|station|hub|cradle)|dc coupler|dummy battery|ac adapter|power adapter|power supply|power bank)\b/ },
  { slug: "batteries", label: "Batteries", one: "battery", group: "power", maxUsd: 500, cameraRank: 1, re: /\b(battery|batteries|battery pack)\b(?!\s*(cover|door|compartment|lid))|\b(np-?f[wz]\d{2,3}|np-?(bx|bn|bg|fh|fm|fv|fp|w)\d{1,3}|lp-?e\d{1,2}[a-z]*|en-?el\d{1,2}[a-z]*|nb-?\d{1,2}[a-z]*|np-?w\d{3}[a-z]*|dmw-?bl[a-z]{1,2}\d{2}[a-z]*|bln-?\d|blx-?\d|blh-?\d|d-?li\d{2,3}|bp-?\d{3}|db-?\d{3})\b/ },
  { slug: "straps", label: "Straps & clips", one: "strap", group: "carry", maxUsd: 400, re: /\b(straps?|wrist strap|neck strap|sling strap|harness|capture clip|camera clip|anchor links)\b/ },
  { slug: "filters", label: "Filters", one: "filter", group: "lens", maxUsd: 1000, re: /\b(filters?|polari[sz]ers?|polari[sz]ing|cpl|nd\d{1,4}|vnd|variable nd|uv protector|step[- ]up ring|step[- ]down ring|filter holder|filter kit|black mist|mist filter|diffusion)\b/ },
  // Lighting: flash heads on the camera, battery/studio strobes, triggers,
  // continuous LEDs and modifiers are bought and compared separately.
  { slug: "modifiers", label: "Light modifiers", one: "modifier", group: "light", maxUsd: 2000, re: /\b((speedlite|speedlight|flash) (bracket|insert|shoe|mount|holder|diffuser|bender|gel|stand adapter)|magmod|maggrid|magbounce|magsphere|softbox|soft box|umbrella|reflector|beauty dish|octabox|strip ?box|stripbox|light modifier|diffuser|barndoors?|snoot|grid|honeycomb|gel(s)?|light stand|c-stand|boom arm|backdrop|background)\b/ },
  { slug: "triggers", label: "Wireless triggers", one: "trigger", group: "light", maxUsd: 600, cameraRank: 7, re: /\b(flash trigger|wireless trigger|triggers?|transmitter|transceiver|flash receiver|pocket ?wizard|profoto connect|air remote|godox (x3|x2t|x1t|xpro(ii)?|x pro)|xproii|x2t-[cnsfop]|xpro-[cnsfop]|x3-[cnsfop])\b/ },
  { slug: "strobes", label: "Studio & portable strobes", one: "strobe", group: "light", maxUsd: 8000, re: /\b(strobes?|monolights?|studio flash|flash head|pack ?flash|ad100 ?pro|ad200 ?pro( ?ii)?|ad200|ad300 ?pro|ad400 ?pro|ad600 ?(pro|bm)?( ?ii)?|ad1200 ?pro|ad300|ad600|profoto (b10x?|b1x|d2|d30|b2)|fj400|fj80|elinchrom (one|three|five|elc|elb)|siros|lumedyne)\b/ },
  { slug: "flashes", label: "Speedlights & flashes", one: "flash", group: "light", maxUsd: 1500, cameraRank: 6, re: /\b(flash|flashgun|speedlite|speedlight|speedlites|speedlights|ring flash|macro flash|(godox|neewer|profoto|flashpoint) (v1|v1pro|v100|v860 ?(ii|iii)?|v850|tt685 ?(ii)?|tt350|tt600|v350|iv?60|lux|a10|a1x|a1)|sb-\d{3,4}|hvl-f\d{2}[a-z]*|fl-\d{3}r?|dmw-fl\d{3}[a-z]*|speedlite el-\d{1,3})\b(?![- ]?(drive|memory|card|storage|ssd))/ },
  { slug: "led-lights", label: "Continuous LED lights", one: "LED light", group: "light", maxUsd: 6000, re: /\b(led (video |panel |light|lamp|tube)|video light|light panel|led panel|cob light|cob led|tube light|light tube|ring ?light|fill light|amaran|nanlite|forza|aputure ls|light storm|sl60|sl150|sl200|ml60|ml30|lc500|led light|on-camera light)\b/ },
  { slug: "microphones", label: "Microphones & audio", one: "microphone", group: "audio", maxUsd: 2000, re: /\b(microphones?|mic|mics|lavalier|lav|shotgun|windscreen|deadcat|dead cat|wind ?muff|audio recorder|handy recorder|field recorder|wireless audio|xlr adapter|audio adapter)\b/ },
  { slug: "remotes", label: "Remotes & releases", one: "remote", group: "other", maxUsd: 500, re: /\b(remote|remotes|shutter release|cable release|release cable|intervalometer|remote commander|remote control|bluetooth remote)\b/ },
  { slug: "caps-hoods", label: "Lens caps & hoods", one: "cap or hood", group: "lens", maxUsd: 200, re: /\b(lens cap|lens caps|front cap|rear cap|rear lens cap|body cap|snap cap|cap set|lens hood|hood|lens cover|body cover)\b/ },
  { slug: "adapters", label: "Mount adapters & teleconverters", one: "adapter", group: "lens", maxUsd: 2500, re: /\b(mount adapter|lens adapter|adapter ring|speed ?booster|focal reducer|lens turbo|teleconverter|tele-converter|tele converter|extender|extension tubes?|macro tubes?|adapter|adaptor)\b/ },
  { slug: "cleaning", label: "Cleaning", one: "cleaning kit", group: "other", maxUsd: 250, re: /\b(cleaning|cleaner|sensor swabs?|swabs?|air blower|rocket blower|blower|lens pen|lenspen|microfib(er|re) cloth|lens tissue|lens wipes|sensor (clean|loupe))\b/ },
  { slug: "monitors", label: "Monitors & recorders", one: "monitor", group: "other", maxUsd: 6000, re: /\b(field monitor|on-camera monitor|camera monitor|monitor[- ]recorder|recording monitor|external recorder|ninja (v|ultra|phone)|shogun|shinobi|smallhd|director'?s monitor|evf|electronic viewfinder)\b/ },
  { slug: "bags", label: "Bags & cases", one: "bag", group: "carry", maxUsd: 1500, re: /\b(camera bag|bags?|backpacks?|sling|slings|messenger|shoulder bag|camera case|hard case|rolling case|roller|holster|pouch|camera insert|camera cube|core unit|lens case|half case|leather case|body case|camera jacket|protector jacket|wrap|cases?|duffel|tote|rain cover|rain sleeve)\b/ },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
export const accessoryCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug) ?? null;
/** Categories whose listings carry a capacity, so price per GB means something. */
export const PER_GB_CATEGORIES = new Set(["memory-cards", "storage"]);
/** Lighting categories that work with one camera maker's TTL (`cameraBrands`). */
export const SYSTEM_CATEGORIES = new Set(["flashes", "triggers"]);

// Not camera accessories at all, whatever else the title says. Camera shops
// sell binoculars, knives, TVs and printer ink too.
const JUNK =
  /\b(binoculars?|monocular|riflescope|rifle ?scope|spotting scope|scope mount|scope rings?|red dot|reflex sight|thermal|night vision|knife|knives|blade|multi-tool|telescope|tvs?|soundbar|sound bar|turntable|headphones?|earbuds|speakers?|printers?|ink|toner|cartridges?|filament|sunglasses|goggles|drones?|fishfinder|sonar|smartwatch|watch|keyboard|midi|gaming|iphone|ipad|airpods|phone case|smartphone|laptop|macbook|notebook|chromebook|imac|desktop pc|playstation|xbox|nintendo|guidebook|ebook|book|warranty|protection plan|protection pack|gift card|archery|crossbow|pistol|gun|ammo|hunting|golf|rangefinder binocular|microscope|projector|vacuum|ice maker|blender|e-?bike|scooter|router|wi-?fi mesh|garmin|fitbit|toy|lego|guitar|ukulele|violin|hearing protection|heater|simulator|aviation|handbag|purse|trijicon|holosun|glock|aimpoint|surface pro|snapdragon|\d+\s?gb ram|tablet pcs?|trail cam(era)?s?|game cam(era)?s?|security cam(era)?s?|dash ?cam|doorbell|baby monitor|blu-?ray|dvd|calculators?|chrono|sig sauer|trigger guard|laser sight|gun laser)\b/;
// A Shopify product type that says the listing is a camera, a lens or something else entirely.
const JUNK_TYPE = /^(film |digital )?(bodies|body|lens|lenses)$|\b(camera (bundle|kit)s?|digital cameras?|mirrorless cameras?|dslrs?|compact cameras?|film bodies|laptops?|notebooks?|tablets?|umbrellas|optic|scope|guitar)\b/;
// Not a working item.
const BROKEN = /\b(for parts|parts only|not working|broken|as[- ]is|faulty|untested|box only|empty box|replica|manual only|rental)\b/;
// A camera or a lens being sold, with an accessory thrown in.
const CAMERA_PRODUCT = /\b\d{1,3}(\.\d)?\s?mp\b|\b(mirrorless|dslr|slr|camcorder|digital camera|instant camera|action camera|cinema camera|point[- ]and[- ]shoot|compact camera|underwater camera|film camera|rangefinder camera|camera body|body only|lens kit|camera (bundle|kit))\b/;
// A lens: focal length followed by an aperture ("24-70mm f/2.8", "50mm F1.4").
const LENSY = /\b\d{1,4}(-\d{1,4})?\s?mm\s*(f\/?|1:)\s?\d/;
const FLASH_PART = /\b(cables?|cords?|sync cover|covers?|diffusers?|brackets?|bounce|bender|holders?|cases?|pouch|shoe mount|stand adapter|mounting foot|feet|foot|batter(y|ies)|battery pack|chargers?|filters?|gels?|dome|softbox|grid|snoot|extension|terminal|adapters?|rails?|clamp|replacement|parts?)\b/;
const ADDON = /\bwith\b|\bw\/|\+|\bplus\b|\band\b|&|\bincl|\bbundle\b|\bkit\b/;
const FOR_WORD = /\b(for|fits|compatible with|suits)\b/;

// ------------------------------------------------------------------- brands

export type AccessoryBrand = { slug: string; name: string; re: RegExp };
const b = (slug: string, name: string, re: RegExp): AccessoryBrand => ({ slug, name, re });

export const ACCESSORY_BRANDS: AccessoryBrand[] = [
  b("smallrig", "SmallRig", /\bsmall ?rig\b/),
  b("tilta", "Tilta", /\btilta\b/),
  b("8sinn", "8Sinn", /\b8 ?sinn\b/),
  b("kondor-blue", "Kondor Blue", /\bkondor blue\b/),
  b("wooden-camera", "Wooden Camera", /\bwooden camera\b/),
  b("zacuto", "Zacuto", /\bzacuto\b/),
  b("redrock", "Redrock Micro", /\bredrock\b/),
  b("peak-design", "Peak Design", /\bpeak design\b/),
  b("manfrotto", "Manfrotto", /\bmanfrotto\b/),
  b("gitzo", "Gitzo", /\bgitzo\b/),
  b("benro", "Benro", /\bbenro\b/),
  b("sirui", "Sirui", /\bsirui\b/),
  b("leofoto", "Leofoto", /\bleofoto\b/),
  b("rrs", "Really Right Stuff", /\breally right stuff\b|\brrs\b/),
  b("kirk", "Kirk", /\bkirk (enterprises|photo)\b/),
  b("arca-swiss", "Arca-Swiss", /\barca[- ]swiss\b(?!.*\b(compatible|type|style)\b)/),
  b("3-legged-thing", "3 Legged Thing", /\b3 legged thing\b/),
  b("vanguard", "Vanguard", /\bvanguard\b/),
  b("joby", "Joby", /\bjoby\b/),
  b("ulanzi", "Ulanzi", /\bulanzi\b/),
  b("zhiyun", "Zhiyun", /\bzhiyun\b/),
  b("moza", "Moza", /\bmoza\b/),
  b("feiyutech", "FeiyuTech", /\bfeiyu(tech)?\b/),
  b("rode", "Rode", /\br(o|ø)de\b/),
  b("sennheiser", "Sennheiser", /\bsennheiser\b/),
  b("deity", "Deity", /\bdeity\b/),
  b("saramonic", "Saramonic", /\bsaramonic\b/),
  b("shure", "Shure", /\bshure\b/),
  b("hollyland", "Hollyland", /\bhollyland\b/),
  b("zoom", "Zoom", /^zoom\b|\bzoom (h\d|f\d|f-\d)/),
  b("tascam", "Tascam", /\btascam\b/),
  b("godox", "Godox", /\bgodox\b/),
  b("profoto", "Profoto", /\bprofoto\b/),
  b("westcott", "Westcott", /\bwestcott\b/),
  b("elinchrom", "Elinchrom", /\belinchrom\b/),
  b("broncolor", "Broncolor", /\bbroncolor\b/),
  b("nanlite", "Nanlite", /\bnanlite\b|\bnanguang\b/),
  b("aputure", "Aputure", /\baputure\b/),
  b("amaran", "Amaran", /\bamaran\b/),
  b("neewer", "Neewer", /\bneewer\b/),
  b("pocketwizard", "PocketWizard", /\bpocket ?wizard\b/),
  b("nissin", "Nissin", /\bnissin\b/),
  b("metz", "Metz", /\bmetz\b/),
  b("flashpoint", "Flashpoint", /\bflashpoint\b/),
  b("phottix", "Phottix", /\bphottix\b/),
  b("lume-cube", "Lume Cube", /\blume ?cube\b/),
  b("kodak", "Kodak", /\bkodak\b/),
  b("ilford", "Ilford", /\bilford\b/),
  b("harman", "Harman", /\bharman\b|\bkentmere\b/),
  b("lomography", "Lomography", /\blomography\b|\blomo\b/),
  b("cinestill", "CineStill", /\bcine ?still\b/),
  b("foma", "Foma", /\bfoma(pan)?\b/),
  b("polaroid", "Polaroid", /\bpolaroid\b/),
  b("rollei", "Rollei", /\brollei\b/),
  b("sandisk", "SanDisk", /\bsan ?disk\b/),
  b("prograde", "ProGrade Digital", /\bprograde\b/),
  b("lexar", "Lexar", /\blexar\b/),
  b("angelbird", "Angelbird", /\bangelbird\b/),
  b("delkin", "Delkin", /\bdelkin\b/),
  b("kingston", "Kingston", /\bkingston\b/),
  b("samsung", "Samsung", /\bsamsung\b/),
  b("crucial", "Crucial", /\bcrucial\b/),
  b("wd", "WD", /\bwestern digital\b|\bwd\b/),
  b("seagate", "Seagate", /\bseagate\b|\blacie\b/),
  b("oyen", "OWC", /\bowc\b/),
  b("transcend", "Transcend", /\btranscend\b/),
  b("pny", "PNY", /\bpny\b/),
  b("atomos", "Atomos", /\batomos\b/),
  b("smallhd", "SmallHD", /\bsmall ?hd\b/),
  b("feelworld", "Feelworld", /\bfeelworld\b/),
  b("portkeys", "Portkeys", /\bportkeys\b/),
  b("nisi", "NiSi", /\bnisi\b/),
  b("kase", "Kase", /\bkase\b/),
  b("hoya", "Hoya", /\bhoya\b/),
  b("b-w", "B+W", /\bb\s?\+\s?w\b|\bschneider b\+w\b/),
  b("kf-concept", "K&F Concept", /\bk\s?&\s?f\b|\bkentfaith\b/),
  b("freewell", "Freewell", /\bfreewell\b/),
  b("polarpro", "PolarPro", /\bpolar ?pro\b/),
  b("tiffen", "Tiffen", /\btiffen\b/),
  b("lee-filters", "Lee Filters", /\blee filters?\b|\blee (100|85|seven5|sw150)\b/),
  b("haida", "Haida", /\bhaida\b/),
  b("cokin", "Cokin", /\bcokin\b/),
  b("breakthrough", "Breakthrough Photography", /\bbreakthrough photography\b/),
  b("urth", "Urth", /\burth\b/),
  b("marumi", "Marumi", /\bmarumi\b/),
  b("heliopan", "Heliopan", /\bheliopan\b/),
  b("moment", "Moment", /^moment\b/),
  b("lowepro", "Lowepro", /\blowepro\b/),
  b("think-tank", "Think Tank", /\bthink ?tank\b/),
  b("wandrd", "Wandrd", /\bwandrd\b/),
  b("shimoda", "Shimoda", /\bshimoda\b/),
  b("tenba", "Tenba", /\btenba\b/),
  b("billingham", "Billingham", /\bbillingham\b/),
  b("domke", "Domke", /\bdomke\b/),
  b("f-stop", "f-stop", /\bf-stop gear\b|^f-stop\b/),
  b("pelican", "Pelican", /\bpelican\b/),
  b("nanuk", "Nanuk", /\bnanuk\b/),
  b("oberwerth", "Oberwerth", /\boberwerth\b/),
  b("op-tech", "OP/TECH", /\bop[\/ -]?tech\b/),
  b("blackrapid", "BlackRapid", /\bblack ?rapid\b/),
  b("cotton-carrier", "Cotton Carrier", /\bcotton carrier\b/),
  b("spider", "Spider Holster", /\bspider (holster|pro|camera holster)\b/),
  b("watson", "Watson", /\bwatson\b/),
  b("wasabi", "Wasabi Power", /\bwasabi\b/),
  b("kingma", "Kingma", /\bkingma\b/),
  b("patona", "Patona", /\bpatona\b/),
  b("jupio", "Jupio", /\bjupio\b/),
  b("nitecore", "Nitecore", /\bnitecore\b/),
  b("hahnel", "Hähnel", /\bh(a|ä)hnel\b/),
  b("jjc", "JJC", /\bjjc\b/),
  b("vello", "Vello", /\bvello\b/),
  b("promaster", "ProMaster", /\bpromaster\b/),
  b("anker", "Anker", /\banker\b/),
  b("metabones", "Metabones", /\bmetabones\b/),
  b("fotodiox", "Fotodiox", /\bfotodiox\b/),
  b("kipon", "Kipon", /\bkipon\b/),
  b("commlite", "Commlite", /\bcommlite\b/),
  b("techart", "Techart", /\btechart\b/),
  b("vsgo", "VSGO", /\bvsgo\b/),
  b("giottos", "Giottos", /\bgiottos\b/),
  b("visibledust", "VisibleDust", /\bvisible ?dust\b/),
  b("lenspen", "LensPen", /\blens ?pen\b/),
  b("zeiss", "Zeiss", /\bzeiss\b/),
  b("brandess", "Brandess", /\bbrandess\b/),
  b("vidpro", "Vidpro", /\bvidpro\b/),
  b("gvm", "GVM", /\bgvm\b/),
  b("glyph", "Glyph", /\bglyph\b/),
  b("koah", "Koah", /\bkoah\b/),
  b("fxlion", "FXLion", /\bfxlion\b/),
  b("photoflex", "Photoflex", /\bphotoflex\b/),
  b("fotopro", "Fotopro", /\bfotopro\b/),
  b("ifootage", "iFootage", /\bifootage\b/),
  b("sachtler", "Sachtler", /\bsachtler\b/),
  b("ikan", "ikan", /\bikan\b/),
  b("audio-technica", "Audio-Technica", /\baudio-technica\b/),
  b("beyerdynamic", "Beyerdynamic", /\bbeyerdynamic\b/),
  b("blue", "Blue", /\bblue (microphones|yeti)\b/),
  b("tether-tools", "Tether Tools", /\btether tools\b/),
  b("expert-shield", "Expert Shield", /\bexpert shield\b/),
  b("startrc", "STARTRC", /\bstartrc\b/),
  b("knox-gear", "Knox Gear", /\bknox gear\b/),
  b("tiffen-domke", "Tiffen", /\bdavis & sanford\b/),
  b("dji", "DJI", /\bdji\b/),
  b("insta360", "Insta360", /\binsta360\b/),
  b("gopro", "GoPro", /\bgopro\b/),
  b("blackmagic", "Blackmagic Design", /\bblackmagic\b/),
  // Camera makers' own accessories.
  b("sony", "Sony", /\bsony\b/),
  b("canon", "Canon", /\bcanon\b/),
  b("nikon", "Nikon", /\bnikon\b/),
  b("fujifilm", "Fujifilm", /\bfuji(film)?\b|\binstax\b/),
  b("panasonic", "Panasonic", /\bpanasonic\b|\blumix\b/),
  b("om-system", "OM System", /\bom system\b|\bom digital\b|\bolympus\b/),
  b("leica", "Leica", /\bleica\b/),
  b("ricoh", "Ricoh / Pentax", /\bricoh\b|\bpentax\b/),
  b("sigma", "Sigma", /\bsigma\b/),
  b("hasselblad", "Hasselblad", /\bhasselblad\b/),
  b("tamron", "Tamron", /\btamron\b/),
  b("viltrox", "Viltrox", /\bviltrox\b/),
];
const BRAND_BY_SLUG = new Map(ACCESSORY_BRANDS.map((x) => [x.slug, x]));
export const accessoryBrandName = (slug: string | null) => (slug ? (BRAND_BY_SLUG.get(slug)?.name ?? slug) : null);
const CAMERA_MAKERS = new Set(Object.keys(BRAND_WORDS));

// Lowercase, accents folded, "&amp;" undone: what every regex here reads.
const lowerOf = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/α/g, "a")
    .replace(/\s+/g, " ")
    .trim();

/** The accessory brand: the first one named before any "for …" (which names the camera). */
export function accessoryBrandOf(title: string, vendor?: string | null): string | null {
  // "(Sony NP-F960 Equivalent)", "replacement for Canon …" name the camera maker, not the maker.
  const lower = lowerOf(title).replace(/\([^)]*\b(equivalent|compatible|replacement|replaces)\b[^)]*\)/g, " ");
  const forAt = lower.search(/\b(for|fits|compatible with|suits|replacement|replaces|equivalent)\b/);
  const head = forAt >= 0 ? lower.slice(0, forAt) : lower;
  let best: { slug: string; at: number } | null = null;
  for (const br of ACCESSORY_BRANDS) {
    const m = br.re.exec(head);
    if (m && (!best || m.index < best.at)) best = { slug: br.slug, at: m.index };
  }
  if (best?.at === 0) return best.slug;
  if (vendor) {
    const v = lowerOf(vendor);
    for (const br of ACCESSORY_BRANDS) if (br.re.test(v)) return br.slug;
  }
  return best?.slug ?? null;
}

// --------------------------------------------------------------------- film

const FILM_STOCK =
  /\b(portra|ektar|ultramax|ultra max|colorplus|color plus|gold 200|kodak gold|tri-?x|t-?max|ektachrome|vision ?3|hp5|fp4|delta (100|400|3200)|pan ?f|xp2|ortho plus|kentmere|phoenix|superia|velvia|provia|acros|fujicolor|c200|instax (mini|wide|square)? ?film|cinestill|800t|400d|50d|lomochrome|lomography (color|colour|berlin|earl grey|lady grey|metropolis|purple|redscale|potsdam)|fomapan|retropan|rollei (retro|rpx|infrared|ortho)|i-?type film|600 film|sx-?70 film|go film|instant film|film pack|peel-?apart)\b/;
const FILM_FORMAT = /\b(35\s?mm|135|120|220|4x5|8x10|medium format|instant|36\s?exp|24\s?exp|\d{2}\s?exposures?|roll|rolls|propack|pro pack|iso \d{2,4}|\d{2,4} iso)\b/;
const FILM_BRANDS = /\b(kodak|ilford|harman|fuji(film)?|lomography|cinestill|foma|polaroid|rollei|agfa|kentmere|adox|bergger|washi|ferrania)\b/;

/** Film stock (rolls, sheets, instant packs), never a film camera or a protective film. */
export function isFilmStock(lower: string): boolean {
  if (!/\bfilms?\b/.test(lower) && !FILM_STOCK.test(lower)) return false;
  if (/\b(protector|protective|screen|lamination|window|wrap|tint|scanner|scanning|holder|developing tank|developer|fixer|changing bag|dryer|carrier|loader)\b/.test(lower)) return false;
  const forAt = lower.search(FOR_WORD);
  const head = forAt >= 0 ? lower.slice(0, forAt) : lower;
  if (/\b(camera|cameras|slr|rangefinder|body|lens)\b/.test(head) && !/\b(instant film|film for)\b/.test(lower)) return false;
  return FILM_STOCK.test(lower) || (FILM_BRANDS.test(lower) && FILM_FORMAT.test(lower));
}

// -------------------------------------------------------------------- specs

/** Fields a listing's title gives for comparing like with like. All optional. */
export const accessorySpecsSchema = z
  .object({
    format: z.string().optional(), // memory cards: "cfexpress-b" …; storage: "portable-ssd" …; cables: "hdmi" …
    capacityGB: z.number().positive().optional(), // total, packs multiplied out
    pack: z.number().int().positive().optional(),
    readMBs: z.number().positive().optional(),
    writeMBs: z.number().positive().optional(),
    vClass: z.number().int().optional(), // SD video speed class: 30, 60, 90
    vpg: z.number().int().optional(), // CFexpress VPG: 200, 400
    uhs: z.enum(["UHS-I", "UHS-II", "UHS-III"]).optional(),
    hdmi: z.string().optional(), // connectors: "Micro HDMI to HDMI"
    hdmiVersion: z.string().optional(), // "2.0", "2.1"
    usb: z.string().optional(), // "USB 3.2 Gen 2", "Thunderbolt 4", "USB4"
    gbps: z.number().positive().optional(), // rated cable speed
    watts: z.number().positive().optional(), // USB-C power delivery
    lengthM: z.number().positive().optional(),
  })
  .strict();
export type AccessorySpecs = z.infer<typeof accessorySpecsSchema>;

export const CARD_FORMATS: Record<string, string> = {
  "cfexpress-b": "CFexpress Type B",
  "cfexpress-a": "CFexpress Type A",
  "cfexpress-4": "CFexpress 4.0 (type not stated)",
  cfexpress: "CFexpress (type not stated)",
  xqd: "XQD",
  cfast: "CFast",
  cf: "CompactFlash",
  microsd: "microSD",
  sd: "SD",
};
export const STORAGE_FORMATS: Record<string, string> = {
  "portable-ssd": "Portable SSD",
  nvme: "NVMe / M.2 SSD",
  ssd: "SSD (2.5-inch / recorder)",
  hdd: "Hard drive",
  "card-reader": "Card reader",
};
export const CABLE_FORMATS: Record<string, string> = {
  hdmi: "HDMI",
  thunderbolt: "Thunderbolt",
  usb4: "USB4",
  "usb-c": "USB-C",
  usb: "USB (other)",
  sdi: "SDI",
  other: "Other cable",
};
export const formatLabel = (category: string, f: string | undefined) =>
  f ? ((category === "memory-cards" ? CARD_FORMATS : category === "storage" ? STORAGE_FORMATS : category === "cables" ? CABLE_FORMATS : {})[f] ?? f) : null;

function cardFormat(l: string): string | undefined {
  if (/\bcf ?express\b/.test(l)) {
    if (/\btype[- ]?b\b|\bcfexpress[- ]b\b|\bb type\b/.test(l)) return "cfexpress-b";
    if (/\btype[- ]?a\b|\bcfexpress[- ]a\b|\ba type\b/.test(l)) return "cfexpress-a";
    if (/\b4\.0\b/.test(l)) return "cfexpress-4";
    return "cfexpress";
  }
  if (/\bxqd\b/.test(l)) return "xqd";
  if (/\bcfast\b/.test(l)) return "cfast";
  if (/\b(compactflash|compact flash|cf card)\b/.test(l)) return "cf";
  if (/\bmicro[- ]?sd(hc|xc|uc)?\b|\btf card\b/.test(l)) return "microsd";
  if (/\bsd(hc|xc|uc)?\b|\bsecure digital\b/.test(l)) return "sd";
  return undefined;
}

function storageFormat(l: string): string | undefined {
  if (/\b(card reader|memory card reader|media reader|reader)\b/.test(l)) return "card-reader";
  if (/\b(hard drive|hard disk|hdd|rugged drive|desktop drive)\b/.test(l) && !/\bssd\b/.test(l)) return "hdd";
  if (/\b(nvme|m\.2|pcie)\b/.test(l) && !/\b(portable|external|enclosure|thunderbolt|usb|usb-c)\b/.test(l)) return "nvme";
  if (/\b(portable|external|usb|thunderbolt|t7|t9|x9|x10|x6|extreme pro|extreme portable|rugged|pro-g40|g-drive)\b/.test(l) && /\b(ssd|drive)\b/.test(l)) return "portable-ssd";
  if (/\b(ssd|master caddy|ssd mini)\b/.test(l)) return "ssd";
  if (/\bportable drive|external drive\b/.test(l)) return "hdd";
  return undefined;
}

/** Capacity in GB, packs multiplied out: "128GB 2-Pack" → 256. */
export function capacityOf(l: string): { capacityGB?: number; pack?: number } {
  const caps = [...l.matchAll(/\b(\d+(?:\.\d+)?)\s?(gb|tb)\b/g)].map((m) => Number(m[1]) * (m[2] === "tb" ? 1000 : 1)).filter((n) => n >= 1 && n <= 100000);
  if (!caps.length) return {};
  // "512GB (2 x 256GB)": the biggest number is the total; otherwise multiply a pack count.
  const cap = Math.max(...caps);
  const packM = l.match(/\b(\d{1,2})[- ]?(pack|pk|cards?)\b|\b(\d{1,2})\s?x\s?\d+(?:\.\d+)?\s?(gb|tb)\b|\b(twin|dual|two)[- ]pack\b|\bpack of (\d{1,2})\b/);
  const pack = packM ? Number(packM[1] ?? packM[3] ?? packM[6] ?? 2) : 1;
  const explicitTotal = caps.length > 1 && /\(\s*\d{1,2}\s?x/.test(l);
  if (pack > 1 && pack <= 20 && !explicitTotal) return { capacityGB: cap * pack, pack };
  return { capacityGB: cap, ...(pack > 1 ? { pack } : {}) };
}

/** Read and write speeds in MB/s as a title states them ("1700/1500MB/s", "up to 300MB/s read, 260MB/s write"). */
export function speedOf(l: string): { readMBs?: number; writeMBs?: number } {
  const pair = l.match(/\b(\d{2,5})\s?(?:mb\/?s)?\s?\/\s?(\d{2,5})\s?mb\/?s\b/);
  if (pair) return { readMBs: Number(pair[1]), writeMBs: Number(pair[2]) };
  const read = l.match(/\b(\d{2,5})\s?mb\/?s\s*(?:read|r\b)|\bread(?: speeds?)?(?: of)?(?: up to)?:?\s?(\d{2,5})\s?mb\/?s/);
  const write = l.match(/\b(\d{2,5})\s?mb\/?s\s*(?:write|w\b)|\bwrite(?: speeds?)?(?: of)?(?: up to)?:?\s?(\d{2,5})\s?mb\/?s/);
  const out: { readMBs?: number; writeMBs?: number } = {};
  if (read) out.readMBs = Number(read[1] ?? read[2]);
  if (write) out.writeMBs = Number(write[1] ?? write[2]);
  if (!out.readMBs) {
    const any = l.match(/\b(\d{2,5})\s?mb\/?s\b/);
    if (any && Number(any[1]) !== out.writeMBs) out.readMBs = Number(any[1]);
  }
  if (!out.readMBs && !out.writeMBs) {
    // "1800x": multiples of CD speed, 150 KB/s.
    const x = l.match(/\b(\d{3,4})x\b/);
    if (x) return { readMBs: Math.round(Number(x[1]) * 0.15) };
    const gbs = l.match(/\b(\d(?:\.\d)?)\s?gb\/s\b/); // "2GB/s" on drives
    if (gbs) out.readMBs = Number(gbs[1]) * 1000;
  }
  return out;
}

function lengthOf(l: string): number | undefined {
  const m = l.match(/\b(\d+(?:\.\d+)?)\s?(m|meters?|metres?|cm|ft|feet|foot|in|inch|inches|')(?=[\s,)\/-]|$)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const u = m[2];
  const metres = u.startsWith("cm") ? n / 100 : /^(ft|feet|foot|')$/.test(u) ? n * 0.3048 : /^(in|inch|inches)$/.test(u) ? n * 0.0254 : n;
  return metres > 0 && metres <= 50 ? Math.round(metres * 100) / 100 : undefined;
}

function cableSpecs(l: string): AccessorySpecs {
  const s: AccessorySpecs = {};
  if (/\bhdmi\b/.test(l)) {
    s.format = "hdmi";
    const ends = [...l.matchAll(/\b(micro|mini|full[- ]size|standard)?\s?hdmi\b/g)].map((m) => (m[1] ? (m[1].startsWith("micro") ? "Micro HDMI" : m[1].startsWith("mini") ? "Mini HDMI" : "HDMI") : "HDMI"));
    if (/\bmicro\b/.test(l) && !ends.includes("Micro HDMI")) ends.push("Micro HDMI");
    else if (/\bmini\b/.test(l) && !ends.includes("Mini HDMI")) ends.push("Mini HDMI");
    const uniq = [...new Set(ends)];
    s.hdmi = uniq.length > 1 ? `${uniq.find((e) => e !== "HDMI") ?? uniq[0]} to HDMI` : uniq[0] === "HDMI" && ends.length > 1 ? "HDMI to HDMI" : uniq[0];
    const v = l.match(/\bhdmi\s?(2\.1|2\.0|1\.4|2\.1a|2\.1b)\b/);
    if (v) s.hdmiVersion = v[1].slice(0, 3);
    else if (/\b(8k|48\s?gbps|ultra high speed)\b/.test(l)) s.hdmiVersion = "2.1";
    else if (/\b(18\s?gbps|premium high speed)\b/.test(l)) s.hdmiVersion = "2.0";
  } else if (/\bsdi\b/.test(l)) s.format = "sdi";
  else if (/\bthunderbolt\s?(5|4|3)|\btb\s?(5|4|3)\b/.test(l)) {
    s.format = "thunderbolt";
    const n = l.match(/\bthunderbolt\s?(5|4|3)|\btb\s?(5|4|3)\b/)!;
    s.usb = `Thunderbolt ${n[1] ?? n[2]}`;
    s.gbps = { "5": 80, "4": 40, "3": 40 }[(n[1] ?? n[2]) as "5" | "4" | "3"];
  } else if (/\busb\s?4\b/.test(l)) {
    s.format = "usb4";
    s.usb = "USB4";
    s.gbps = /\b80\s?gbps\b/.test(l) ? 80 : 40;
  } else if (/\busb[- ]?c\b|\btype[- ]?c\b/.test(l)) s.format = "usb-c";
  else if (/\busb\b/.test(l)) s.format = "usb";
  else s.format = "other";
  if (s.format === "usb-c" || s.format === "usb") {
    const g = l.match(/\busb\s?3\.2\s?gen\s?(2x2|2|1)\b|\busb\s?3\.(1|0)\b|\busb\s?2\.0\b/);
    if (g) {
      s.usb = g[0].replace(/\s+/g, " ").replace(/^usb/, "USB").replace("gen", "Gen");
      s.gbps = g[1] === "2x2" ? 20 : g[1] === "2" ? 10 : g[1] === "1" ? 5 : g[2] === "1" ? 10 : g[2] === "0" ? 5 : 0.48;
    }
  }
  const gb = l.match(/\b(\d{1,3})\s?gbps\b/);
  if (gb && !s.gbps) s.gbps = Number(gb[1]);
  const w = l.match(/\b(\d{2,3})\s?w\b/);
  if (w && s.format !== "hdmi") s.watts = Number(w[1]);
  const len = lengthOf(l);
  if (len) s.lengthM = len;
  return s;
}

/** A zero or non-number read from a title is unknown, not a value: dropped. */
function clean(s: AccessorySpecs): AccessorySpecs {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== "" && !(typeof v === "number" && !(Number.isFinite(v) && v > 0))) out[k] = v;
  return out as AccessorySpecs;
}

function specsFor(category: string, l: string): AccessorySpecs {
  return clean(rawSpecs(category, l));
}

function rawSpecs(category: string, title: string): AccessorySpecs {
  const l = title.replace(/(\d),(\d{3})(?!\d)/g, "$1$2"); // "5,000MB/s" → "5000MB/s"
  if (category === "memory-cards") {
    const s: AccessorySpecs = { ...capacityOf(l), ...speedOf(l) };
    const f = cardFormat(l);
    if (f) s.format = f;
    const v = l.match(/\bv(30|60|90)\b/);
    if (v) s.vClass = Number(v[1]);
    const vpg = l.match(/\bvpg[- ]?(200|400|65|20)\b/);
    if (vpg) s.vpg = Number(vpg[1]);
    const u = l.match(/\buhs[- ]?(iii|ii|i|3|2|1)\b/);
    if (u) s.uhs = ({ i: "UHS-I", "1": "UHS-I", ii: "UHS-II", "2": "UHS-II", iii: "UHS-III", "3": "UHS-III" } as const)[u[1] as "i"];
    return s;
  }
  if (category === "storage") {
    const s: AccessorySpecs = { ...capacityOf(l), ...speedOf(l) };
    const f = storageFormat(l);
    if (f) s.format = f;
    if (f === "card-reader") {
      delete s.capacityGB;
      delete s.pack;
    }
    return s;
  }
  if (category === "cables") return cableSpecs(l);
  return {};
}

// ---------------------------------------------------- cameras and systems

type Hit = { p: Matchable; from: number; to: number };
const GENERATION = /^(?:ii|iii|iv|v|vi|vii|viii|ix)$/;
const BODY_VARIANT = /^(?:s|r|c|pro|plus|max|mini|lite|ultra|se)$/;

function brandNamedIn(brand: string, words: string[], joined: string): boolean {
  return (BRAND_WORDS[brand] ?? [brand]).some((n) => {
    const c = compact(n);
    return c.length >= 5 ? joined.includes(c) : words.includes(c);
  });
}

/**
 * Catalog cameras a title names, with the camera's brand named in it too (or
 * made by that brand). A name followed by a generation or variant the catalog
 * lacks ("R6 Mark III") is not read as the older model. `direct` hits are not
 * after "for"/"fits": the title may be selling that camera.
 */
export function camerasIn(title: string, index: CatalogIndex, accessoryBrand: string | null = null): { slug: string; direct: boolean }[] {
  const words = tokens(title);
  const joined = words.join("");
  const found = new Map<string, Hit>();
  for (let i = 0; i < words.length; i++) {
    let key = "";
    for (let j = i; j < Math.min(words.length, i + 12); j++) {
      key += words[j];
      const ps = (index.aliases.get(key) ?? []).filter((p) => p.kind === "camera");
      if (ps.length !== 1) continue; // none, or an alias two cameras share
      const p = ps[0];
      const prev = found.get(p.slug);
      if (!prev || prev.to - prev.from < j - i) found.set(p.slug, { p, from: i, to: j });
    }
  }
  let hits = [...found.values()];
  hits = hits.filter((h) => !hits.some((o) => o !== h && o.to - o.from > h.to - h.from && o.from <= h.from && o.to >= h.to));
  return hits
    .filter((h) => {
      const next = words[h.to + 1] ?? "";
      if (GENERATION.test(next) || (BODY_VARIANT.test(next) && words[h.to + 2] !== "mount")) return false;
      // A bare number or one-letter alias ("1", "a1", "r") needs the brand right before it.
      return brandNamedIn(h.p.brand, words, joined) || accessoryBrand === h.p.brand || h.p.modelCodes.some((m) => joined.includes(compact(m)));
    })
    .sort((a, b) => a.from - b.from)
    .map((h) => ({ slug: h.p.slug, direct: !words.slice(0, h.from).some((w) => w === "for" || w === "fits" || w === "compatible" || w === "suits") }));
}

// Godox/Profoto-style system suffixes: V1-S, X2T-C, XPro-N, A10-F, TT685II-O.
const SYSTEM_SUFFIX = /\b(?:v1|v1pro|v100|v860(?:ii|iii)?|v850(?:ii|iii)?|tt685(?:ii)?|tt350|tt600|v350|iv?60|ving|x1t|x2t|x3|xpro(?:ii)?|xproii|x1r|a10|a1x|a1|connect(?: pro)?|it30(?: pro)?|it32|mf12|tt520|lux senior|ad200pro|ad100pro|ttl)\s?-?\s?(c|n|s|f|o|p|l)\b/g;
const SUFFIX_BRAND: Record<string, string[]> = { c: ["canon"], n: ["nikon"], s: ["sony"], f: ["fujifilm"], o: ["om-system", "panasonic"], p: ["ricoh"], l: ["leica", "panasonic", "sigma"] };
const SYSTEM_WORDS: [RegExp, string][] = [
  [/\bcanon\b/, "canon"],
  [/\bnikon\b/, "nikon"],
  [/\bsony\b/, "sony"],
  [/\bfuji(film)?\b/, "fujifilm"],
  [/\b(olympus|om system|om digital)\b/, "om-system"],
  [/\b(panasonic|lumix)\b/, "panasonic"],
  [/\b(pentax|ricoh)\b/, "ricoh"],
  [/\bleica\b/, "leica"],
  [/\bsigma\b/, "sigma"],
  [/\bhasselblad\b/, "hasselblad"],
  [/\b(micro four thirds|mft|m4\/3)\b/, "om-system"],
];

/** Camera makers an accessory is for: named after "for", a TTL suffix, or the maker's own. */
export function cameraBrandsIn(lower: string, category: string, accessoryBrand: string | null): string[] {
  const out = new Set<string>();
  const forAt = lower.search(FOR_WORD);
  if (forAt >= 0) for (const [re, s] of SYSTEM_WORDS) if (re.test(lower.slice(forAt))) out.add(s);
  if (SYSTEM_CATEGORIES.has(category)) {
    for (const m of lower.matchAll(SYSTEM_SUFFIX)) for (const s of SUFFIX_BRAND[m[1]] ?? []) out.add(s);
    // "Godox V1 Flash (Sony)", "Profoto A10 Canon", "TTL Nikon".
    const paren = lower.match(/\((canon|nikon|sony|fuji(?:film)?|olympus|panasonic|pentax)[^)]*\)/);
    if (paren) for (const [re, s] of SYSTEM_WORDS) if (re.test(paren[0])) out.add(s);
    if (/\b(ttl|i-?ttl|e-?ttl|adi|p-?ttl)\b/.test(lower) || !accessoryBrand || !CAMERA_MAKERS.has(accessoryBrand)) for (const [re, s] of SYSTEM_WORDS) if (re.test(lower) && s !== accessoryBrand && !out.size) out.add(s);
  }
  // A camera maker's own battery, grip or flash is for its own cameras.
  const OEM = new Set(["batteries", "chargers", "grips", "remotes", "flashes", "triggers", "caps-hoods", "adapters", "screen-protectors", "microphones", "plates"]);
  if (accessoryBrand && CAMERA_MAKERS.has(accessoryBrand) && OEM.has(category) && !out.size) out.add(accessoryBrand);
  return [...out].sort();
}

// ----------------------------------------------------------- classification

export type Classified = {
  category: string;
  brand: string | null;
  cameras: string[];
  /** Cameras named outside a "for …" phrase: the title may be selling the camera. */
  direct: string[];
  cameraBrands: string[];
  specs: AccessorySpecs;
};

/**
 * What accessory a listing is, or null. `productType` (Shopify's) is only a
 * fallback when the title alone says nothing, and a junk type refuses.
 */
export function classifyAccessory(listing: { title: string; productType?: string | null; vendor?: string | null }, index?: CatalogIndex): Classified | null {
  const lower = lowerOf(listing.title);
  const type = lowerOf(listing.productType ?? "");
  if (!lower || JUNK.test(lower) || BROKEN.test(lower) || (type && (JUNK.test(type) || JUNK_TYPE.test(type)))) return null;
  let cat: AccessoryCategoryDef | undefined;
  let at = -1;
  if (isFilmStock(lower)) {
    cat = accessoryCategory("film")!;
    at = lower.search(/\bfilms?\b/);
  } else {
    // The kind named first is the product ("FJ400 strobe kit with wireless
    // trigger", "Tripod with ball head and QR plate"); on a tie the list
    // order decides ("battery grip" is a grip).
    // A part for a flash ("Flash Sync Cable", "Flash Diffuser for SB900",
    // "Pocket Wizard Motor Drive Cable") is not a flash or a trigger.
    const flashPart = FLASH_PART.test(lower.split(/\bwith\b|\bw\/|\+|\bincl|\bkit\b/)[0]); // "V1 Flash with Battery" is a flash
    for (const c of CATEGORIES) {
      if (c.slug === "film" || (flashPart && (c.slug === "flashes" || c.slug === "triggers"))) continue;
      const m = c.re.exec(lower);
      if (m && (!cat || m.index < at)) {
        cat = c;
        at = m.index;
      }
    }
  }
  if (!cat && type && !/^(other )?accessor(y|ies)$|^other$/.test(type)) {
    // "Nitecore USN3 Pro for Sony SLR" filed under "Digital Chargers".
    for (const c of CATEGORIES) if (c.slug !== "film" && c.slug !== "cables" && c.re.test(type)) {
      cat = c;
      at = lower.length;
      break;
    }
  }
  if (!cat) return null;
  // "CFexpress Type B Card Reader" is a reader, not a card.
  if (cat.slug === "memory-cards" && /\b(card )?readers?\b|\bhub\b|\bdock\b/.test(lower)) cat = accessoryCategory("storage")!;
  else if (cat.slug === "memory-cards" && /\b(case|wallet|pouch|holder|organi[sz]er)\b/.test(lower) && !/\b\d+\s?(gb|tb)\b/.test(lower)) cat = accessoryCategory("bags")!;
  const forAt = lower.search(FOR_WORD);
  const head = forAt >= 0 ? lower.slice(0, forAt) : lower;
  // A lens being sold ("Nikon Z 24-70mm f/2.8 S, Hood"), or a camera with
  // the accessory thrown in ("… Camera + 64GB Memory Bundle").
  if (LENSY.test(head)) return null;
  const before = lower.slice(0, Math.max(0, at));
  if (CAMERA_PRODUCT.test(head) && (ADDON.test(before) || !/\bcamera (cage|bag|backpack|strap|battery|grip|plate|case|insert|cube|sling|holster|harness|clip|remote|monitor|rig|light|flash|microphone|mic|screen|cleaning|charger)\b/.test(lower))) {
    // "DSLR camera bag" and "mirrorless camera cage" are fine; a camera spec ("24MP", "Mirrorless Camera Body") ahead of an add-on is not.
    if (/\b\d{1,3}(\.\d)?\s?mp\b|\b(camera body|body only|lens kit)\b/.test(head) || ADDON.test(before)) return null;
  }
  const brand = accessoryBrandOf(listing.title, listing.vendor);
  const cams = index ? camerasIn(listing.title, index, brand) : [];
  if (cams.some((c) => c.direct) && ADDON.test(before) && /\b(camera|body|kit|bundle|combo)\b/.test(before)) return null;
  // Film and memory are for any camera that takes them; never "for" one model.
  const camAware = !["film", "memory-cards", "storage", "cables", "adapters"].includes(cat.slug); // an adapter names mounts ("EF-EOS R"), not bodies
  const cameras = camAware ? cams.map((c) => c.slug) : [];
  const direct = camAware ? cams.filter((c) => c.direct).map((c) => c.slug) : [];
  const brands = new Set(cameraBrandsIn(lower, cat.slug, brand));
  if (index) for (const s of cameras) {
    const p = index.bySlug.get(s);
    if (p) brands.add(p.brand);
  }
  return { category: cat.slug, brand, cameras, direct, cameraBrands: camAware || cat.slug === "adapters" ? [...brands].sort() : [], specs: specsFor(cat.slug, lower) };
}

// -------------------------------------------------------------- the offer

export const accessoryOfferSchema = z
  .object({
    title: z.string(),
    category: z.string(),
    brand: z.string().nullable(),
    cameras: z.array(z.string()),
    cameraBrands: z.array(z.string()),
    specs: accessorySpecsSchema,
    retailer: z.string(),
    condition: z.enum(CONDITIONS as [Condition, ...Condition[]]),
    price: z.number().int().positive(), // minor units
    currency: z.enum(CURRENCIES),
    url: z.string().url(),
    inStock: z.boolean(),
    seenAt: z.string(),
    sourceId: z.string().nullable(),
  })
  .strict();
export type AccessoryOffer = z.infer<typeof accessoryOfferSchema>;

/**
 * A source's listing as an accessory offer, or null. Refuse-only price
 * guards: over the category's cap, or a listing that names a catalog camera
 * directly and costs a third of that camera's launch price or more (that is a
 * camera sold with an accessory, not the accessory).
 */
export function accessoryOffer(
  l: { title: string; productType?: string | null; vendor?: string | null; price: number; currency: Currency; url: string; inStock: boolean; condition: Condition; sourceId: string | null },
  index: CatalogIndex,
  retailerKey: string,
  now: string,
): AccessoryOffer | null {
  if (!l.price || l.price < 100) return null; // under 1.00: a sample or a placeholder
  const c = classifyAccessory(l, index);
  if (!c) return null;
  const def = accessoryCategory(c.category)!;
  const major = l.price / 100;
  if (major > def.maxUsd * refRate(l.currency)) return null;
  for (const s of c.direct) {
    const p = index.bySlug.get(s);
    const launch = p ? launchIn(p, l.currency) : null;
    if (launch && major >= launch / 3) return null;
  }
  return { title: l.title.replace(/\s+/g, " ").trim(), category: c.category, brand: c.brand, cameras: c.cameras, cameraBrands: c.cameraBrands, specs: c.specs, retailer: retailerKey, condition: l.condition, price: l.price, currency: l.currency, url: l.url, inStock: l.inStock, seenAt: now, sourceId: l.sourceId };
}

/** Price per GB in minor units ×100 (so cents with two decimals), or null. */
export const perGB = (a: Pick<AccessoryOffer, "price" | "specs">) => (a.specs.capacityGB ? a.price / a.specs.capacityGB : null);

// ------------------------------------------------------- merge and caps

/** Per category (and per category + camera, and per card/drive format + capacity), keep the cheapest. */
export const CAP_PER_CATEGORY = 300;
export const CAP_PER_CAMERA = 30;
export const CAP_PER_FORMAT_SIZE = 8;

const cheapFirst = (a: AccessoryOffer, b: AccessoryOffer) => Number(b.inStock) - Number(a.inStock) || a.price - b.price || a.url.localeCompare(b.url);

/** One row per URL (the cheapest variant), then the caps: a row stays if any of its groups has room. */
export function capAccessories(list: AccessoryOffer[]): AccessoryOffer[] {
  const byUrl = new Map<string, AccessoryOffer>();
  for (const a of list) {
    const k = `${a.retailer} ${a.url.split("?")[0]} ${a.condition} ${a.title}`;
    const prev = byUrl.get(k);
    if (!prev || cheapFirst(a, prev) < 0) byUrl.set(k, a);
  }
  const sorted = [...byUrl.values()].sort(cheapFirst);
  const counts = new Map<string, number>();
  const room = (k: string, cap: number) => (counts.get(k) ?? 0) < cap;
  const take = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  const out: AccessoryOffer[] = [];
  for (const a of sorted) {
    const groups: [string, number][] = [[a.category, CAP_PER_CATEGORY], ...a.cameras.map((c) => [`${a.category}|${c}`, CAP_PER_CAMERA] as [string, number])];
    if (a.specs.format && (a.specs.capacityGB || a.category === "cables")) groups.push([`${a.category}|${a.specs.format}|${a.specs.capacityGB ?? a.specs.gbps ?? a.specs.hdmiVersion ?? ""}`, CAP_PER_FORMAT_SIZE]);
    // Lighting: per camera system too, so every maker's flashes and triggers survive the cap.
    if (SYSTEM_CATEGORIES.has(a.category)) for (const s of a.cameraBrands) groups.push([`${a.category}|sys|${s}`, CAP_PER_CAMERA]);
    if (!groups.some(([k, cap]) => room(k, cap))) continue;
    for (const [k] of groups) take(k);
    out.push(a);
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price || a.url.localeCompare(b.url));
}

export type AccessoryRun = { status: "ok" | "skipped" | "error"; accessories?: AccessoryOffer[]; rotating?: boolean };

/**
 * Same rules as offers (mergeOffers): a retailer that ran replaces its
 * accessories (a rotating source keeps its earlier ones it did not re-read),
 * one that failed or was not run keeps them until `maxAgeH` old, one that is
 * not configured has none.
 */
export function mergeAccessories(prev: AccessoryOffer[], runs: Record<string, AccessoryRun>, now: string, maxAgeH: number, known: (retailer: string) => boolean): AccessoryOffer[] {
  const fresh = (a: AccessoryOffer) => Date.parse(now) - Date.parse(a.seenAt) <= maxAgeH * 3600_000;
  const out: AccessoryOffer[] = [];
  for (const [key, r] of Object.entries(runs)) {
    if (r.status === "ok") {
      const got = r.accessories ?? [];
      out.push(...got);
      if (r.rotating) {
        const seen = new Set(got.map((a) => a.url));
        out.push(...prev.filter((a) => a.retailer === key && fresh(a) && !seen.has(a.url)));
      }
    } else if (r.status === "error") out.push(...prev.filter((a) => a.retailer === key && fresh(a)));
  }
  for (const key of new Set(prev.map((a) => a.retailer))) if (!(key in runs) && known(key)) out.push(...prev.filter((a) => a.retailer === key && fresh(a)));
  return capAccessories(out);
}

// --------------------------------------------------------- price-per-GB history

export type PerGbRow = { category: string; format: string; capacityGB: number; lowest: number; lowestPerGB: number };

/** The day's lowest in-stock new price (and price per GB) per card/drive format and capacity. */
export function perGbHistory(list: AccessoryOffer[]): PerGbRow[] {
  const best = new Map<string, PerGbRow>();
  for (const a of list) {
    if (!PER_GB_CATEGORIES.has(a.category) || !a.inStock || a.condition !== "new" || !a.specs.format || !a.specs.capacityGB) continue;
    const k = `${a.category}|${a.specs.format}|${a.specs.capacityGB}`;
    const per = Math.round((a.price / a.specs.capacityGB) * 100) / 100;
    const prev = best.get(k);
    if (!prev || a.price < prev.lowest) best.set(k, { category: a.category, format: a.specs.format, capacityGB: a.specs.capacityGB, lowest: a.price, lowestPerGB: per });
  }
  return [...best.values()].sort((a, b) => a.category.localeCompare(b.category) || a.format.localeCompare(b.format) || a.capacityGB - b.capacityGB);
}
