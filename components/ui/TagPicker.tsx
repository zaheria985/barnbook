"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Tag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_sub_item_id: string | null;
}

interface TagPickerProps {
  tagType?: string;
  selected: Tag[];
  onChange: (tags: Tag[]) => void;
  allowCreate?: boolean;
  singleSelect?: boolean;
  placeholder?: string;
  onTagSelected?: (tag: Tag) => void;
}

export default function TagPicker({
  tagType,
  selected,
  onChange,
  allowCreate = true,
  singleSelect = false,
  placeholder = "Search tags...",
  onTagSelected,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTags = useCallback(async () => {
    try {
      const url = tagType ? `/api/tags?type=${tagType}` : "/api/tags";
      const res = await fetch(url);
      if (res.ok) setAllTags(await res.json());
    } catch { /* ignore */ }
  }, [tagType]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = allTags.filter((t) => {
    const matchesQuery = !query || t.name.toLowerCase().includes(query.toLowerCase());
    const notSelected = !selected.some((s) => s.id === t.id);
    return matchesQuery && notSelected;
  });

  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.toLowerCase());

  function selectTag(tag: Tag) {
    if (singleSelect) {
      onChange([tag]);
      setQuery(tag.name);
    } else {
      onChange([...selected, tag]);
      setQuery("");
    }
    setShowDropdown(false);
    onTagSelected?.(tag);
  }

  function removeTag(tagId: string) {
    onChange(selected.filter((t) => t.id !== tagId));
    if (singleSelect) setQuery("");
  }

  async function createAndSelect() {
    if (!query.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: query.trim(), tagType: tagType || "label" }),
      });
      if (res.ok) {
        const tag = await res.json();
        selectTag(tag);
        await fetchTags();
      }
    } catch { /* ignore */ }
    setCreating(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags (non-single-select mode) */}
      {!singleSelect && selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}20` : "var(--surface-muted)",
                color: tag.color || "var(--text-secondary)",
                border: `1px solid ${tag.color || "var(--border-light)"}`,
              }}
            >
              {tag.name}
              <button
                onClick={() => removeTag(tag.id)}
                className="ml-0.5 hover:opacity-70"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
      />

      {showDropdown && (filtered.length > 0 || (allowCreate && query.trim() && !exactMatch)) && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {filtered.slice(0, 10).map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectTag(tag)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                {tag.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </button>
            </li>
          ))}
          {allowCreate && query.trim() && !exactMatch && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={createAndSelect}
                disabled={creating}
                className="w-full px-4 py-2 text-left text-sm text-[var(--interactive)] hover:bg-[var(--surface-muted)]"
              >
                {creating ? "Creating..." : `+ Create "${query.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
