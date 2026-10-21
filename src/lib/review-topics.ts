// "What people are saying", from our own members' reviews only: which
// topics their words mention, and whether those mentions sit mostly in
// high-rated (4-5 stars) or low-rated (1-2 stars) reviews. A count of words,
// not a summary anyone wrote; shown only with at least three reviews.
// Client-safe.
export type TopicCount = { key: string; label: string; mentions: number; good: number; bad: number };

const T = (key: string, label: string, re: RegExp, kinds: ("camera" | "lens")[] = ["camera", "lens"]) => ({ key, label, re, kinds });

const TOPICS = [
  T("af", "Autofocus", /\b(auto ?focus\w*|af|eye[- ]?(af|detect\w*)|focus(ing|es)?|tracking)\b/i),
  T("iq", "Image quality", /\b(image quality|sharp\w*|detail\w*|colou?rs?|jpe?gs?|dynamic range|resolution)\b/i),
  T("low", "Low light", /\b(low[- ]light|noise|noisy|high iso|night|indoors?)\b/i),
  T("battery", "Battery life", /\bbatter(y|ies)\b/i, ["camera"]),
  T("size", "Size and weight", /\b(lightweight|compact|small|tiny|heavy|weight|size|portable|pocket\w*|bulky)\b/i),
  T("handling", "Handling and controls", /\b(grip|ergonomic\w*|handling|buttons?|dials?|menus?|controls?)\b/i),
  T("video", "Video", /\b(video|4k|footage|vlog\w*|overheat\w*|filming)\b/i, ["camera"]),
  T("screen", "Screen and viewfinder", /\b(screen|lcd|touch ?screen|evf|viewfinder)\b/i, ["camera"]),
  T("ibis", "Stabilisation", /\b(ibis|stabili[sz]\w*|shak(e|y))\b/i),
  T("bokeh", "Bokeh", /\b(bokeh|background blur|blur\w*)\b/i, ["lens"]),
  T("optics", "Flare and distortion", /\b(flare|distortion|vignett\w*|chromatic|fringing)\b/i, ["lens"]),
  T("build", "Build and sealing", /\b(build|weather\w*|sealed|sealing|plastic|sturdy|durab\w*|solid)\b/i),
  T("value", "Price and value", /\b(price[ds]?|value|cheap\w*|expensive|worth|money|bargain)\b/i),
  T("easy", "Ease of use", /\b(beginners?|first camera|easy to use|intuitive|learn\w*|simple)\b/i, ["camera"]),
];

/** Topics mentioned in at least two reviews (one, with fewer than five reviews), most mentioned first, at most `max`. */
export function reviewTopics(reviews: { rating: number; body: string }[], kind: "camera" | "lens", max = 6): TopicCount[] {
  const min = reviews.length < 5 ? 1 : 2;
  return TOPICS.filter((t) => t.kinds.includes(kind))
    .map((t) => {
      const hits = reviews.filter((r) => t.re.test(r.body));
      return { key: t.key, label: t.label, mentions: hits.length, good: hits.filter((r) => r.rating >= 4).length, bad: hits.filter((r) => r.rating <= 2).length };
    })
    .filter((t) => t.mentions >= min)
    .sort((a, b) => b.mentions - a.mentions || a.label.localeCompare(b.label))
    .slice(0, max);
}

/** "mostly in 4-5 star reviews" when at least two thirds of its mentions are; the same for 1-2 stars; else mixed. */
export function topicTone(t: TopicCount): "good" | "bad" | "mixed" {
  if (t.good * 3 >= t.mentions * 2) return "good";
  if (t.bad * 3 >= t.mentions * 2) return "bad";
  return "mixed";
}
