import { useLayoutEffect, useRef } from 'react';

/**
 * Applies fade-in animation to newly streamed text tokens.
 *
 * Strategy:
 * 1. After React commits DOM (via useLayoutEffect), walk text nodes with TreeWalker
 * 2. Compare current text length vs previous to identify "new" text
 * 3. Wrap new text portions in <span class="token-fade"> for CSS animation
 * 4. On next render cycle, cleanup old spans before React reconciliation
 *
 * This avoids React conflicts because cleanup happens synchronously
 * in useLayoutEffect before the next DOM patch.
 */
export function useStreamingFadeIn(
  containerRef: React.RefObject<HTMLElement | null>,
  content: string,
  isStreaming: boolean,
) {
  const prevLenRef = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Always clean up leftover animation spans first —
    // React reconciliation may have left some from previous cycle
    cleanupSpans(container);

    if (!isStreaming) {
      prevLenRef.current = 0;
      return;
    }

    const currentLen = container.textContent?.length ?? 0;

    // Only animate if there's genuinely new text (not first render)
    if (currentLen > prevLenRef.current && prevLenRef.current > 0) {
      wrapNewText(container, prevLenRef.current);
    }

    prevLenRef.current = currentLen;
  }, [content, isStreaming]);

  // Reset tracking on unmount
  useLayoutEffect(() => {
    return () => {
      prevLenRef.current = 0;
    };
  }, []);
}

/**
 * Remove all .token-fade spans, replacing them with plain text nodes.
 * Normalize afterward to merge adjacent text nodes.
 */
function cleanupSpans(container: HTMLElement) {
  const spans = container.querySelectorAll('.token-fade');
  for (const span of spans) {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      parent.normalize();
    }
  }
}

/**
 * Walk all text nodes in the container.
 * For text beyond `prevLen` characters, wrap it in an animated <span>.
 * Process in reverse order to maintain correct DOM positions.
 */
function wrapNewText(container: HTMLElement, prevLen: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodesToProcess: Array<{ node: Text; splitAt: number }> = [];
  let charCount = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent || '';
    const nodeStart = charCount;
    const nodeEnd = charCount + text.length;

    if (nodeEnd > prevLen && node.parentElement) {
      const splitAt = Math.max(0, prevLen - nodeStart);
      nodesToProcess.push({ node, splitAt });
    }

    charCount += text.length;
  }

  // Reverse order: process last nodes first so earlier positions stay valid
  for (let i = nodesToProcess.length - 1; i >= 0; i--) {
    const { node, splitAt } = nodesToProcess[i];
    const text = node.textContent || '';
    const parent = node.parentNode;
    if (!parent) continue;

    if (splitAt > 0 && splitAt < text.length) {
      // Partially new: keep old text, wrap new portion
      const oldPart = document.createTextNode(text.slice(0, splitAt));
      const span = createFadeSpan(text.slice(splitAt));
      parent.insertBefore(oldPart, node);
      parent.insertBefore(span, node);
      parent.removeChild(node);
    } else if (splitAt === 0) {
      // Entirely new text node
      const span = createFadeSpan(text);
      parent.replaceChild(span, node);
    }
  }
}

function createFadeSpan(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'token-fade';
  span.textContent = text;
  return span;
}
