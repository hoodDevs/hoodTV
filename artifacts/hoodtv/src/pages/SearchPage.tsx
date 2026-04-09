import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Film, Tv, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { MediaCard } from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { searchContent, getSearchSuggestions } from "@/lib/api";
import type { MediaItem } from "@/lib/api";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setHasMore(false);
      setPage(1);
      setActiveQuery("");
      return;
    }
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);
    setPage(1);
    setActiveQuery(q);
    searchContent(q, 1).then((data) => {
      setResults(data);
      setHasMore(data.length >= 18);
      setLoading(false);
    });
  }, []);

  const loadMore = useCallback(() => {
    if (!activeQuery || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    searchContent(activeQuery, nextPage).then((data) => {
      setResults((prev) => {
        const existing = new Set(prev.map((r) => r.id));
        const fresh = data.filter((r) => !existing.has(r.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.length >= 18);
      setPage(nextPage);
      setLoadingMore(false);
    });
  }, [activeQuery, page, loadingMore]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);

    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (val.length >= 2) {
      suggestDebounceRef.current = setTimeout(() => {
        getSearchSuggestions(val).then((data) => {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        });
      }, 150);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (item: MediaItem) => {
    setShowSuggestions(false);
    setQuery(item.title);
    setLocation(`/title/${item.id}?type=${item.type}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      doSearch(query);
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="min-h-screen animate-fade-in" style={{ backgroundColor: "#0a0a0a" }}>
      <div className="pt-10 px-4 sm:px-8 pb-16 max-w-7xl mx-auto">
        <div className="relative max-w-2xl mx-auto mb-10" ref={wrapperRef}>
          <Search
            size={22}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a0a0] z-10 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search movies, TV shows..."
            data-testid="search-input"
            className="w-full pl-12 pr-12 py-4 rounded-xl text-white placeholder-[#a0a0a0] text-lg font-medium focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              "--tw-ring-color": "#7F77DD",
            } as React.CSSProperties}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSuggestions([]);
                setSearched(false);
                setShowSuggestions(false);
                setHasMore(false);
                setPage(1);
                setActiveQuery("");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white z-10"
              data-testid="search-clear"
            >
              <X size={18} />
            </button>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}
              data-testid="search-suggestions"
            >
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSuggestionClick(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left group"
                >
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-9 h-12 object-cover rounded flex-shrink-0"
                      style={{ minWidth: "36px" }}
                    />
                  ) : (
                    <div
                      className="w-9 h-12 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: "#252525", minWidth: "36px" }}
                    >
                      {item.type === "tv" ? (
                        <Tv size={14} className="text-[#a0a0a0]" />
                      ) : (
                        <Film size={14} className="text-[#a0a0a0]" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate group-hover:text-[#7F77DD] transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[#a0a0a0] text-xs mt-0.5">
                      {item.year && <span>{item.year}</span>}
                      {item.year && item.type && <span className="mx-1">·</span>}
                      {item.type && (
                        <span className="capitalize">
                          {item.type === "tv" ? "TV Show" : "Movie"}
                        </span>
                      )}
                    </p>
                  </div>
                  {item.rating && (
                    <span className="text-[#a0a0a0] text-xs flex-shrink-0">
                      ★ {item.rating.toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-lg w-full bg-[#1a1a1a]" />
                <Skeleton className="h-3 w-3/4 mt-2 bg-[#1a1a1a]" />
              </div>
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-20" data-testid="search-empty">
            <p className="text-[#a0a0a0] text-lg">No results found for "{query}"</p>
            <p className="text-[#a0a0a0] text-sm mt-2">Try a different search term</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-[#a0a0a0] text-sm mb-6" data-testid="search-results-count">
              {results.length} result{results.length !== 1 ? "s" : ""} for "{activeQuery}"
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item) => (
                <MediaCard key={item.id} item={item} fill />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    color: "#c0bdf5",
                  }}
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#7F77DD] border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Load More
                    </>
                  )}
                </button>
              </div>
            )}

            {loadingMore && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[2/3] rounded-lg w-full bg-[#1a1a1a]" />
                    <Skeleton className="h-3 w-3/4 mt-2 bg-[#1a1a1a]" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!searched && (
          <div className="text-center py-20 text-[#a0a0a0]" data-testid="search-prompt">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Start typing to search for movies and TV shows</p>
          </div>
        )}
      </div>
    </div>
  );
}
