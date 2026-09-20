"use client";

import { useMemo, useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";

export type SearchSelectOption = {
  id: string;
  label: string;
  hint?: string;
};

export function SearchSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = "No matches",
  hideLabel = false,
}: {
  id: string;
  label: string;
  options: SearchSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  emptyLabel?: string;
  hideLabel?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options.slice(0, 12);
    }
    return options
      .filter((option) => `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [options, query]);

  return (
    <div className="space-y-1.5">
      {hideLabel ? null : <Label htmlFor={id}>{label}</Label>}
      {selected ? (
        <p className="type-meta text-foreground">
          Selected: <span className="font-medium">{selected.label}</span>
        </p>
      ) : null}
      <Input
        id={id}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={label}
      />
      <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
        {filtered.length === 0 ? (
          <li className="type-meta px-2.5 py-2">{emptyLabel}</li>
        ) : (
          filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-2.5 py-1.5 text-left type-body hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  option.id === value && "bg-accent text-accent-foreground",
                )}
                onClick={() => onChange(option.id)}
              >
                <span>{option.label}</span>
                {option.hint ? <span className="type-meta">{option.hint}</span> : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
