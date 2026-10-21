import { Check, Copy, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  disabled?: boolean;
}

export function CopyButton({ text, label, disabled = false }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || !text || text.includes('••••')) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('copy_failed');
      }
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2200);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !text || text.includes('••••')}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {state === 'copied' ? <Check size={13} className="text-emerald-600" /> : state === 'failed' ? <AlertCircle size={13} className="text-red-600" /> : <Copy size={13} />}
      {state === 'copied' ? 'Kopyalandı' : state === 'failed' ? 'Kopyalanamadı' : label || 'Kopyala'}
    </button>
  );
}
