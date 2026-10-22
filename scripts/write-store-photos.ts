// data/store-photos.json from every market's offers (src/lib/store-photos.ts).
// The import writes it too; refresh-prices runs the markets as parallel jobs,
// so the commit job rebuilds it once after collecting every market's offers.
import { hasLicensedThumb } from "../src/lib/images";
import { writeStorePhotos } from "../src/lib/store-photos";

console.log(`${writeStorePhotos(hasLicensedThumb)} store photos for products without a licensed thumbnail`);
