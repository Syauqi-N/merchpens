"use client";

import { useMemo, useState } from "react";
import { CalendarDaysIcon, CheckIcon, Clock3Icon, RotateCcwIcon } from "lucide-react";
import { id as localeId } from "date-fns/locale";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute);

  return valid ? date : null;
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return valid ? date : null;
}

function toLocalDateValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
  ].join("");
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Picker tanggal tanpa waktu untuk filter admin.
 *
 * Nilainya tetap `YYYY-MM-DD` supaya aman ditulis ke URL dan kompatibel dengan
 * parser filter server, tetapi tampilannya memakai kalender yang sama dengan
 * form periode Pre-Order.
 */
export function DatePicker({
  id,
  value,
  min,
  max,
  invalid = false,
  onChange,
}: {
  id: string;
  value: string;
  min?: string;
  max?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocalDate(value), [value]);
  const minimum = useMemo(() => (min ? parseLocalDate(min) : null), [min]);
  const maximum = useMemo(() => (max ? parseLocalDate(max) : null), [max]);

  function commit(candidate: Date) {
    let next = startOfLocalDay(candidate);
    const minimumDay = minimum ? startOfLocalDay(minimum) : null;
    const maximumDay = maximum ? startOfLocalDay(maximum) : null;

    if (minimumDay && next < minimumDay) next = minimumDay;
    if (maximumDay && next > maximumDay) next = maximumDay;

    onChange(toLocalDateValue(next));
  }

  const disabledDays = [
    ...(minimum ? [{ before: startOfLocalDay(minimum) }] : []),
    ...(maximum ? [{ after: startOfLocalDay(maximum) }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        aria-invalid={invalid}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-full justify-start gap-2 px-2.5 text-left font-normal",
          !selected && "text-cream-muted",
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
          <CalendarDaysIcon className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {selected ? FORMAT_TANGGAL.format(selected) : "Pilih tanggal"}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl p-0"
      >
        <PopoverHeader className="border-b border-white/10 px-4 py-3">
          <PopoverTitle className="flex items-center gap-2 text-cream">
            <CalendarDaysIcon className="size-4 text-gold" aria-hidden />
            Pilih tanggal
          </PopoverTitle>
          <PopoverDescription>
            Tanggal mengikuti waktu lokal Indonesia.
          </PopoverDescription>
        </PopoverHeader>

        <Calendar
          mode="single"
          locale={localeId}
          selected={selected ?? undefined}
          defaultMonth={selected ?? minimum ?? maximum ?? new Date()}
          onSelect={(date) => {
            if (date) commit(date);
          }}
          disabled={disabledDays.length > 0 ? disabledDays : undefined}
          className="mx-auto p-3"
        />

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => commit(new Date())}
          >
            <RotateCcwIcon className="size-3.5" aria-hidden />
            Hari ini
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            <CheckIcon className="size-3.5" aria-hidden />
            Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DateTimePicker({
  id,
  value,
  min,
  invalid = false,
  onChange,
}: {
  id: string;
  value: string;
  min?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocalDateTime(value), [value]);
  const minimum = useMemo(() => (min ? parseLocalDateTime(min) : null), [min]);

  function commit(candidate: Date) {
    const next = minimum && candidate < minimum ? new Date(minimum) : candidate;
    next.setSeconds(0, 0);
    onChange(toLocalDateTimeValue(next));
    return next;
  }

  function selectDate(date: Date | undefined) {
    if (!date) return;

    const base = selected ?? minimum ?? new Date();
    date.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(date);
  }

  function selectTime(nextValue: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(nextValue);
    if (!match) return null;

    const next = new Date(selected ?? minimum ?? new Date());
    next.setHours(Number(match[1]), Number(match[2]));
    return formatTime(commit(next));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        aria-invalid={invalid}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-auto min-h-11 w-full justify-start gap-3 px-3 py-2 text-left font-normal",
          !selected && "text-cream-muted",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <CalendarDaysIcon className="size-4" aria-hidden />
        </span>

        {selected ? (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="truncate font-medium text-cream">
              {FORMAT_TANGGAL.format(selected)}
            </span>
            <span className="shrink-0 rounded-md bg-raise px-2 py-1 font-mono text-xs font-semibold text-[#D8D3C7]">
              {formatTime(selected)}
            </span>
          </span>
        ) : (
          <span>Pilih tanggal dan waktu</span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl p-0"
      >
        <PopoverHeader className="border-b border-white/10 px-4 py-3">
          <PopoverTitle className="flex items-center gap-2 text-cream">
            <CalendarDaysIcon className="size-4 text-gold" aria-hidden />
            Pilih tanggal &amp; waktu
          </PopoverTitle>
          <PopoverDescription>Format 24 jam, mengikuti waktu lokal.</PopoverDescription>
        </PopoverHeader>

        <Calendar
          mode="single"
          locale={localeId}
          selected={selected ?? undefined}
          defaultMonth={selected ?? minimum ?? new Date()}
          onSelect={selectDate}
          disabled={minimum ? { before: startOfLocalDay(minimum) } : undefined}
          className="mx-auto p-3"
        />

        <div className="border-t border-white/10 bg-obsidian/70 px-4 py-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-cream-muted">
            <Clock3Icon className="size-4 text-gold" aria-hidden />
            Waktu
          </div>

          <TimeInput
            key={formatTime(selected ?? minimum ?? new Date())}
            id={`${id}-time`}
            value={formatTime(selected ?? minimum ?? new Date())}
            onCommit={selectTime}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => commit(new Date())}
          >
            <RotateCcwIcon className="size-3.5" aria-hidden />
            Sekarang
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            <CheckIcon className="size-3.5" aria-hidden />
            Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalizeTimeInput(raw: string): string {
  const safe = raw.replace(/[^\d:]/g, "");

  if (safe.includes(":")) {
    const [hour = "", minute = ""] = safe.split(":");
    return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
  }

  const digits = safe.slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function TimeInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit: (value: string) => string | null;
}) {
  const [draft, setDraft] = useState(value);

  function commit() {
    const match = /^(\d{2}):(\d{2})$/.exec(draft);
    const valid =
      match !== null && Number(match[1]) <= 23 && Number(match[2]) <= 59;

    if (!valid) {
      setDraft(value);
      return;
    }

    setDraft(onCommit(draft) ?? value);
  }

  return (
    <label htmlFor={id} className="grid gap-1">
      <span className="text-[11px] font-medium text-cream-muted">
        Jam &amp; menit <span className="font-normal">(24 jam)</span>
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="HH:mm"
        aria-label="Waktu dalam format 24 jam"
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(normalizeTimeInput(event.target.value))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        className="h-10 bg-coal font-mono text-base font-semibold tracking-wide"
      />
      <span className="text-[11px] text-cream-muted">Contoh: 18:30</span>
    </label>
  );
}
