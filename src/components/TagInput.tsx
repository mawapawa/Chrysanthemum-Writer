import { useState, useRef, useEffect } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  existingTags: string[];
  placeholder?: string;
}

export default function TagInput({ tags, onChange, existingTags, placeholder = "Add tag..." }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = input.trim()
    ? existingTags
        .filter(t => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t))
        .slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addTag = (tag: string) => {
    const cleaned = tag.trim();
    if (!cleaned || tags.includes(cleaned)) return;
    onChange([...tags, cleaned]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-indigo-400 hover:text-indigo-200 cursor-pointer leading-none"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); addTag(input); }
          if (e.key === "Backspace" && !input && tags.length > 0) { removeTag(tags[tags.length - 1]); }
          if (e.key === "Escape") setShowSuggestions(false);
        }}
        onFocus={() => input.trim() && setShowSuggestions(true)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-32 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
