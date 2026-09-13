import React from "react";
import { CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Parses and formats text into readable headings, bullet points, numbered lists,
 * and paragraphs, preserving newlines and structure.
 */
export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;

  // Split into lines
  const lines = text.split(/\r?\n/);

  // Group lines into blocks (paragraphs, list items, headings)
  const elements: React.ReactNode[] = [];
  let currentList: { type: "bullet" | "number"; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join(" ").trim();
      if (pText) {
        elements.push(
          <p key={`p-${elements.length}`} className="leading-relaxed text-cream-muted">
            {pText}
          </p>
        );
      }
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList && currentList.items.length > 0) {
      const listType = currentList.type;
      const items = [...currentList.items];
      currentList = null;

      if (listType === "bullet") {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 space-y-1.5 pl-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-cream-muted leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2 space-y-1.5 pl-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-cream-muted leading-relaxed">
                <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[10px] font-bold text-gold font-mono">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        );
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      // Empty line -> separator
      flushList();
      flushParagraph();
      continue;
    }

    // Check if line is a heading/section title:
    // e.g. "PILIHAN MERCHANDISE", "SIAPA YANG BISA IKUT?", "KETENTUAN KARYA", "### Judul", "1. Ketentuan:"
    const isMarkdownHeading = /^#{1,4}\s+(.+)$/.test(trimmed);
    const isAllCapsHeading =
      trimmed.length >= 3 &&
      trimmed.length <= 60 &&
      trimmed === trimmed.toUpperCase() &&
      !/^[\d\W]+$/.test(trimmed) &&
      !/^(\d+[\.\)]|[-*•])/.test(trimmed);
    const isQuestionHeading =
      /^(SIAPA|BAGAIMANA|KAPAN|SYARAT|KETENTUAN|CARA|HADIAH|ALUR)\b.*\?$/i.test(trimmed);

    if (isMarkdownHeading || isAllCapsHeading || isQuestionHeading) {
      flushList();
      flushParagraph();

      const headingText = trimmed.replace(/^#{1,4}\s+/, "");
      elements.push(
        <h4
          key={`h-${elements.length}`}
          className="pt-3 first:pt-0 font-bold uppercase tracking-wider text-gold text-xs sm:text-sm"
        >
          {headingText}
        </h4>
      );
      continue;
    }

    // Check for numbered list (e.g. "1. Tumbler", "1) Tumbler")
    const numberMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "number") {
        flushList();
        currentList = { type: "number", items: [] };
      }
      currentList.items.push(numberMatch[2]);
      continue;
    }

    // Check for bullet list (e.g. "- Item", "* Item", "• Item", "e Item", "« Item")
    const bulletMatch = trimmed.match(/^[-*•–—\u2022]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "bullet") {
        flushList();
        currentList = { type: "bullet", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Regular line -> accumulate in current paragraph
    currentParagraph.push(trimmed);
  }

  flushList();
  flushParagraph();

  return <div className={cn("space-y-2.5 text-xs sm:text-sm", className)}>{elements}</div>;
}
