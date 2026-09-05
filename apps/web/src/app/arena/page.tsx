import { redirect } from "next/navigation";
import { arena } from "@/lib/data";

export default function ArenaIndex() {
  redirect(`/arena/${arena.id}`);
}
