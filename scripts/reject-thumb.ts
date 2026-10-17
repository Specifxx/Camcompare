// A reviewer's "that photo is wrong": remove the thumbnail and its credit,
// and remember the file so fetch-thumbnails never picks it again.
//   npm run thumbs:reject -- slug1,slug2
import { addReject, readCredits, removeThumb } from "../src/lib/images";

const credits = readCredits();
for (const slug of (process.argv[2] ?? "").split(",").filter(Boolean)) {
  const c = credits[slug];
  if (c) addReject(slug, c.file);
  removeThumb(slug);
  console.log(`${slug}: rejected ${c?.file ?? "(no credit)"}`);
}
