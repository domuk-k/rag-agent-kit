import { memo } from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Code, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}

function ToolbarButton({ onClick, isActive, disabled, icon, label }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded',
        'text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive && 'bg-muted text-foreground'
      )}
      aria-label={label}
      aria-pressed={isActive}
    >
      {icon}
    </button>
  );
}

export const EditorToolbar = memo(function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const iconSize = 'h-4 w-4';

  return (
    <div
      className="flex items-center gap-0.5 border-b px-2 py-1"
      role="toolbar"
      aria-label="텍스트 서식"
    >
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={<Bold className={iconSize} />}
        label="굵게"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={<Italic className={iconSize} />}
        label="기울임"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        icon={<Code className={iconSize} />}
        label="인라인 코드"
      />

      <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={<List className={iconSize} />}
        label="글머리 기호"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={<ListOrdered className={iconSize} />}
        label="번호 매기기"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        icon={<Quote className={iconSize} />}
        label="인용"
      />

      <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        icon={<Undo className={iconSize} />}
        label="실행 취소"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        icon={<Redo className={iconSize} />}
        label="다시 실행"
      />
    </div>
  );
});
