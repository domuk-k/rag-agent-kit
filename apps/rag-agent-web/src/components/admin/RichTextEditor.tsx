import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorToolbar } from './EditorToolbar';
import { cn } from '@/lib/utils';
import '@/styles/tiptap.css';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Admin용 Tiptap 리치 텍스트 에디터
 * - 볼드, 이탤릭, 코드 등 마크다운 서식 지원
 */
export function RichTextEditor({
  value = '',
  onChange,
  placeholder = '내용을 입력하세요...',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(htmlToMarkdown(editor.getHTML()));
    },
  });

  return (
    <div className={cn('rounded-xl border bg-background', className)}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * 간단한 HTML → 마크다운 변환
 */
function htmlToMarkdown(html: string): string {
  return html
    // Block elements
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    // Inline formatting
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    // Lists
    .replace(/<ul>/g, '')
    .replace(/<\/ul>/g, '')
    .replace(/<ol>/g, '')
    .replace(/<\/ol>/g, '')
    .replace(/<li>(.*?)<\/li>/g, '• $1\n')
    // Blockquote
    .replace(/<blockquote>(.*?)<\/blockquote>/gs, '> $1\n')
    // Code blocks
    .replace(/<pre><code>(.*?)<\/code><\/pre>/gs, '```\n$1\n```\n')
    // Clean up
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
