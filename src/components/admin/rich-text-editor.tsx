"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo, Undo, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WYSIWYG editor producing a restricted HTML subset. The output is sanitised
 * again on the server (lib/sanitize) before storage and before rendering.
 */
export function RichTextEditor({ value, onChange, id, invalid }: { value: string; onChange: (html: string) => void; id?: string; invalid?: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"], HTMLAttributes: { rel: "noopener noreferrer" } }),
    ],
    content: value || "",
    editorProps: { attributes: { class: "prose-cms text-sm", ...(id ? { id } : {}), "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  if (!editor) return <div className="h-48 rounded-lg border bg-muted/40" />;

  const btn = (active: boolean, onClick: () => void, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("rounded p-1.5 hover:bg-muted", active && "bg-muted text-primary")}
    >
      <Icon className="size-4" />
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://… or /page)", prev ?? "");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|\/|mailto:|tel:)/.test(url)) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className={cn("tiptap-editor rounded-lg border bg-background", invalid && "border-destructive")}>
      <div className="flex flex-wrap gap-0.5 border-b p-1" role="toolbar" aria-label="Formatting">
        {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading", Heading2)}
        {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Subheading", Heading3)}
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold", Bold)}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic", Italic)}
        {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bulleted list", List)}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list", ListOrdered)}
        {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote", Quote)}
        {btn(editor.isActive("link"), setLink, "Add link", Link2)}
        {btn(false, () => editor.chain().focus().unsetLink().run(), "Remove link", Unlink)}
        <span className="mx-1 w-px bg-border" />
        {btn(false, () => editor.chain().focus().undo().run(), "Undo", Undo)}
        {btn(false, () => editor.chain().focus().redo().run(), "Redo", Redo)}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
