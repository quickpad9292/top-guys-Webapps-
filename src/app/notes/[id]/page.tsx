import { NoteView } from "@/components/editor/note-view";

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  return <NoteView key={id} id={id} />;
}
