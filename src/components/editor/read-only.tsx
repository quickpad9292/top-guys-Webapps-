"use client";

import { EditorContent, useEditor, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";

export function ReadOnlyNote({ content }: { content: unknown }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content: content as Content,
    extensions: [
      StarterKit.configure({ link: { openOnClick: true, HTMLAttributes: { class: "text-accent underline", rel: "noopener noreferrer nofollow", target: "_blank" } } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Highlight,
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-accent prose-blockquote:border-l-accent prose-blockquote:not-italic prose-code:before:content-none prose-code:after:content-none prose-pre:my-0 !min-h-0",
      },
    },
  });
  return <EditorContent editor={editor} />;
}
