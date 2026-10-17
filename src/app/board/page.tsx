import BoardView, { boardMetadata } from "@/views/BoardView";

export const metadata = boardMetadata("us");
export default function Page() {
  return <BoardView market="us" />;
}
