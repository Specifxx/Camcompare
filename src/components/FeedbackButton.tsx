// The floating "Feedback" button, mounted once in the root layout. A server
// component only to tell the widget whether feedback storage is connected
// (DATABASE_URL, read at build like every other Vercel variable); without
// it the panel says feedback isn't connected yet instead of failing on Send.
import FeedbackWidget from "./FeedbackWidget";

export default function FeedbackButton() {
  return <FeedbackWidget connected={Boolean(process.env.DATABASE_URL?.trim())} />;
}
