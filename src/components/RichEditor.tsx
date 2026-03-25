'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect } from 'react'

const COLORS = [
  { label: 'Wit', value: '#e8eaf0' },
  { label: 'Blauw', value: '#4d82bd' },
  { label: 'Goud', value: '#b8935a' },
  { label: 'Grijs', value: '#6b7084' },
  { label: 'Groen', value: '#4caf50' },
  { label: 'Rood', value: '#ef5350' },
]

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--color-accent)' : 'var(--color-bg-hover)',
        color: active ? '#fff' : 'var(--color-text)',
        transition: 'background 0.15s',
        minWidth: '30px',
      }}
    >
      {children}
    </button>
  )
}

export default function RichEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: [
          'min-height: 400px',
          'padding: 16px',
          'outline: none',
          'font-size: 14px',
          'line-height: 1.8',
          'color: var(--color-heading)',
        ].join('; '),
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [value])

  if (!editor) return null

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-bg-card)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '10px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-elevated)',
      }}>
        {/* Headings */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Kop 2">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Kop 3">H3</ToolbarBtn>

        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Text formatting */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Vet"><b>B</b></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursief"><i>I</i></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Onderstrepen"><u>U</u></ToolbarBtn>

        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Lists */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Opsomming">• Lijst</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Genummerde lijst">1. Lijst</ToolbarBtn>

        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Align */}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Links">≡</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Midden">≡</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rechts">≡</ToolbarBtn>

        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Colors */}
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c.value).run() }}
            title={c.label}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: c.value,
              border: editor.isActive('textStyle', { color: c.value }) ? '2px solid white' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}

        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Blockquote & clear */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citaat">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} active={false} title="Opmaak verwijderen">✕</ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      <style>{`
        .tiptap h2 {
          font-family: var(--font-display);
          font-size: 1.85rem;
          font-weight: 700;
          color: var(--color-heading);
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--color-border);
          line-height: 1.2;
        }
        .tiptap h3 {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 600;
          color: var(--color-heading);
          margin-top: 1.25rem;
          margin-bottom: 0.4rem;
          line-height: 1.3;
        }
        .tiptap p { margin-bottom: 0.75rem; }
        .tiptap ul, .tiptap ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .tiptap ul { list-style-type: disc; }
        .tiptap ol { list-style-type: decimal; }
        .tiptap li { margin-bottom: 0.3rem; }
        .tiptap blockquote {
          border-left: 3px solid var(--color-accent-dim);
          padding-left: 1rem;
          margin: 1rem 0;
          color: var(--color-text-muted);
          font-style: italic;
        }
        .tiptap strong { font-weight: 600; color: var(--color-heading); }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--color-text-dim);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
}
