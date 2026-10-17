import HomeView, { homeMetadata } from "@/views/HomeView";
import { marketParam } from "./market";

// Only the four markets: any other first segment (/favicon.ico, /wp-login.php)
// is the static 404, not a render (see ./layout.tsx).
export const dynamicParams = false;

type P = { params: { market: string } };
export const generateMetadata = ({ params }: P) => homeMetadata(marketParam(params));
export default function Page({ params }: P) {
  return <HomeView market={marketParam(params)} />;
}
