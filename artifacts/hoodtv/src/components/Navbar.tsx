import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Film, Tv, TrendingUp, Bookmark, Search, X, Music } from "lucide-react";

export const SIDEBAR_WIDTH = 220;

export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useLocation();

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "^K";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const navLinks = [
    { label: "Home", href: "/", icon: Home },
    { label: "Movies", href: "/movies", icon: Film },
    { label: "TV Shows", href: "/tv", icon: Tv },
    { label: "Music", href: "/music", icon: Music },
    { label: "Trending", href: "/trending", icon: TrendingUp },
    { label: "My List", href: "/mylist", icon: Bookmark },
  ];

  return (
    <>
      <nav
        data-testid="navbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${SIDEBAR_WIDTH}px`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          background: "rgba(8,8,14,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo */}
        <Link href="/" data-testid="nav-logo">
          <div
            style={{
              padding: "28px 24px 32px",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "26px",
              letterSpacing: "2px",
              color: "#fff",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ho<span style={{ color: "#7F77DD" }}>o</span>dTV
          </div>
        </Link>

        {/* Nav links */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", padding: "0 12px" }}>
          {navLinks.map(({ label, href, icon: Icon }) => {
            const basePath = href.split("?")[0];
            const isActive = basePath === "/" ? location === "/" : location.startsWith(basePath);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-link-${label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: isActive ? "rgba(127,119,221,0.15)" : "transparent",
                    color: isActive ? "#c0bdf5" : "#666",
                    transition: "background 0.18s, color 0.18s",
                    fontSize: "13.5px",
                    fontWeight: isActive ? 500 : 400,
                    letterSpacing: "0.02em",
                  }}
                  className="sidebar-link"
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ flexShrink: 0, color: isActive ? "#9D97E8" : "#555" }}
                  />
                  {label}
                  {isActive && (
                    <div
                      style={{
                        marginLeft: "auto",
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "#7F77DD",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ margin: "0 16px", height: "1px", background: "rgba(255,255,255,0.05)" }} />

        {/* Bottom actions */}
        <div style={{ padding: "14px 12px 24px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            onClick={() => setSearchOpen(true)}
            data-testid="nav-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#666",
              fontSize: "13.5px",
              fontWeight: 400,
              letterSpacing: "0.02em",
              width: "100%",
              transition: "background 0.18s, color 0.18s",
            }}
            className="sidebar-link"
          >
            <Search size={17} strokeWidth={1.8} style={{ flexShrink: 0, color: "#555" }} />
            Search
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                color: "#3d3d4f",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "4px",
                padding: "1px 5px",
                letterSpacing: "0.04em",
                fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              {shortcutLabel}
            </span>
          </button>

          {/* Profile */}
          <Link href="/profile">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                padding: "10px 14px",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background 0.18s",
                background: location.startsWith("/profile") ? "rgba(127,119,221,0.15)" : "transparent",
              }}
              className="sidebar-link"
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, rgba(127,119,221,0.3) 0%, rgba(157,151,232,0.15) 100%)",
                  border: `1.5px solid ${location.startsWith("/profile") ? "rgba(127,119,221,0.7)" : "rgba(127,119,221,0.5)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9D97E8",
                  flexShrink: 0,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.03em",
                }}
              >
                HT
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", color: location.startsWith("/profile") ? "#c0bdf5" : "#888", fontWeight: location.startsWith("/profile") ? 500 : 400, lineHeight: 1.2 }}>
                  Profile
                </p>
              </div>
              {location.startsWith("/profile") && (
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#7F77DD", flexShrink: 0 }} />
              )}
            </div>
          </Link>
        </div>
      </nav>

      {/* Search overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(5,5,12,0.96)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: "120px",
          opacity: searchOpen ? 1 : 0,
          pointerEvents: searchOpen ? "all" : "none",
          transition: "opacity 0.25s",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
      >
        <div style={{ width: "100%", maxWidth: "640px", padding: "0 24px" }}>
          <form onSubmit={handleSearch}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                borderBottom: "1.5px solid #7F77DD",
                paddingBottom: "12px",
              }}
            >
              <Search size={22} color="#7F77DD" style={{ flexShrink: 0 }} />
              <input
                autoFocus={searchOpen}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, genres…"
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                  fontSize: "22px",
                  fontWeight: 300,
                  color: "#f0f0f0",
                  caretColor: "#7F77DD",
                }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: "24px", lineHeight: 1 }}
                className="hover:!text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </form>
          <p style={{ fontSize: "12px", color: "#444", marginTop: "14px", letterSpacing: "0.04em" }}>
            Try "Black Panther", "Action", "2024" · Press Enter to search
          </p>
        </div>
      </div>

      <style>{`
        .sidebar-link:hover {
          background: rgba(255,255,255,0.05) !important;
          color: #d0cef5 !important;
        }
        .sidebar-link:hover svg {
          color: #9D97E8 !important;
        }
      `}</style>
    </>
  );
}
