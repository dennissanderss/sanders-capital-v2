'use client'

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import BaseImage from '@tiptap/extension-image'
import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// Custom image node with float support
const FloatImage = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      float: { default: 'none' },
      width: { default: '50%' },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, float, width } = node.attrs as { src: string; alt: string; float: string; width: string }

  const imgStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    width,
    ...(float === 'left' ? { float: 'left', margin: '0.5rem 1.5rem 0.75rem 0' } :
        float === 'right' ? { float: 'right', margin: '0.5rem 0 0.75rem 1.5rem' } :
        { margin: '1rem auto' }),
  }

  return (
    <NodeViewWrapper style={{ display: float === 'none' ? 'block' : 'contents' }}>
      <div style={{ position: 'relative', display: float === 'none' ? 'block' : 'contents' }}>
        <img src={src} alt={alt || ''} style={imgStyle} />
        {selected && (
          <div style={{
            position: 'absolute',
            top: float === 'right' ? 4 : 4,
            left: float === 'right' ? undefined : 4,
            right: float === 'right' ? 4 : undefined,
            display: 'flex',
            gap: '3px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '4px',
            zIndex: 10,
          }}>
            {[
              { label: '←', value: 'left', title: 'Links (tekst rechts)' },
              { label: '⊙', value: 'none', title: 'Midden (geen tekst eromheen)' },
              { label: '→', value: 'right', title: 'Rechts (tekst links)' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateAttributes({ float: opt.value }) }}
                title={opt.title}
                style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  background: float === opt.value ? 'var(--color-accent)' : 'var(--color-bg-hover)',
                  color: float === opt.value ? '#fff' : 'var(--color-text)',
                }}
              >
                {opt.label}
              </button>
            ))}
            <div style={{ width: 1, background: 'var(--color-border)', margin: '0 2px' }} />
            {['30%', '50%', '100%'].map(w => (
              <button
                key={w}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateAttributes({ width: w }) }}
                title={`Breedte ${w}`}
                style={{
                  padding: '2px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  background: width === w ? 'var(--color-accent)' : 'var(--color-bg-hover)',
                  color: width === w ? '#fff' : 'var(--color-text)',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

const COLORS = [
  { label: 'Wit', value: '#e8eaf0' },
  { label: 'Blauw', value: '#4d82bd' },
  { label: 'Goud', value: '#b8935a' },
  { label: 'Grijs', value: '#6b7084' },
  { label: 'Groen', value: '#4caf50' },
  { label: 'Rood', value: '#ef5350' },
]

function ToolbarBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
        border: 'none', cursor: 'pointer', minWidth: '30px',
        background: active ? 'var(--color-accent)' : 'var(--color-bg-hover)',
        color: active ? '#fff' : 'var(--color-text)',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function RichEditor({
  value, onChange, supabase,
}: {
  value: string
  onChange: (html: string) => void
  supabase?: SupabaseClient
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FloatImage,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: 'min-height: 400px; padding: 16px; outline: none; font-size: 14px; line-height: 1.8; color: var(--color-heading);',
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [value])

  async function handleImageUpload(file: File) {
    if (!supabase) return
    setUploading(true)
    try {
      const fileName = `${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('images').upload(fileName, file)
      if (error) { alert('Upload mislukt: ' + error.message); return }
      const { data } = supabase.storage.from('images').getPublicUrl(fileName)
      editor?.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run()
    } finally {
      setUploading(false)
    }
  }

  if (!editor) return null

  const sep = <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 4px' }} />

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-bg-card)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Kop 2">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Kop 3">H3</ToolbarBtn>
        {sep}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Vet"><b>B</b></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursief"><i>I</i></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Onderstrepen"><u>U</u></ToolbarBtn>
        {sep}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Opsomming">• Lijst</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Genummerde lijst">1. Lijst</ToolbarBtn>
        {sep}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Links uitlijnen">⬛︎</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Midden uitlijnen">▪</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rechts uitlijnen">▪</ToolbarBtn>
        {sep}
        {COLORS.map((c) => (
          <button key={c.value} type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c.value).run() }}
            title={c.label}
            style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.value, border: editor.isActive('textStyle', { color: c.value }) ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }}
          />
        ))}
        {sep}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citaat">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} active={false} title="Opmaak verwijderen">✕</ToolbarBtn>
        {sep}
        {/* Image upload */}
        <ToolbarBtn
          onClick={() => fileInputRef.current?.click()}
          active={false}
          title="Afbeelding invoegen"
        >
          {uploading ? '...' : '🖼 Afbeelding'}
        </ToolbarBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = '' }}
        />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      <style>{`
        .tiptap h2 { font-family: var(--font-display); font-size: 1.85rem; font-weight: 700; color: var(--color-heading); margin-top: 1.5rem; margin-bottom: 0.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--color-border); line-height: 1.2; }
        .tiptap h3 { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; color: var(--color-heading); margin-top: 1.25rem; margin-bottom: 0.4rem; line-height: 1.3; }
        .tiptap p { margin-bottom: 0.75rem; }
        .tiptap ul, .tiptap ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .tiptap ul { list-style-type: disc; }
        .tiptap ol { list-style-type: decimal; }
        .tiptap li { margin-bottom: 0.3rem; }
        .tiptap blockquote { border-left: 3px solid var(--color-accent-dim); padding-left: 1rem; margin: 1rem 0; color: var(--color-text-muted); font-style: italic; }
        .tiptap strong { font-weight: 600; color: var(--color-heading); }
        .tiptap::after { content: ''; display: table; clear: both; }
      `}</style>
    </div>
  )
}
