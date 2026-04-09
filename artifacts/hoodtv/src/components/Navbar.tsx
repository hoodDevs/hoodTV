import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, X, Menu } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    { label: "Home", href: "/" },
    { label: "Movies", href: "/movies" },
    { label: "TV Shows", href: "/tv" },
    { label: "Trending", href: "/trending" },
    { label: "My List", href: "/mylist" },
  ];

  const isHome = location === "/";
  const isTransparent = isHome && !scrolled;

  return (
    <>
      <nav
        data-testid="navbar"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between transition-all duration-400"
        style={{
          height: "68px",
          padding: "0 40px",
          background: scrolled || !isHome
            ? "rgba(10,10,10,0.92)"
            : "transparent",
          backdropFilter: scrolled || !isHome ? "blur(14px)" : "none",
          borderBottom: scrolled || !isHome
            ? "0.5px solid rgba(255,255,255,0.06)"
            : "none",
        }}
      >
        <div className="flex items-center gap-9">
          <Link href="/" data-testid="nav-logo">
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "28px",
                letterSpacing: "2px",
                color: "#fff",
                lineHeight: 1,
              }}
            >
              ho<span style={{ color: "#7F77DD" }}>o</span>dTV
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => {
              const basePath = link.href.split("?")[0];
              const isActive =
                basePath === "/" ? location === "/" : location.startsWith(basePath);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-testid={`nav-link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 400,
                    color: isActive ? "#f0f0f0" : "#888",
                    letterSpacing: "0.04em",
                    transition: "color 0.2s",
                  }}
                  className="hover:!text-white"
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => setSearchOpen(true)}
            data-testid="nav-search"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: "4px" }}
            className="hover:!text-white transition-colors"
          >
            <Search size={18} />
          </button>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(127,119,221,0.15)",
              border: "1.5px solid #7F77DD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: 500,
              color: "#7F77DD",
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            HT
          </div>
          <button
            className="md:hidden text-[#888] hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="fixed top-[68px] left-0 right-0 z-40 md:hidden"
          style={{
            background: "rgba(10,10,10,0.97)",
            backdropFilter: "blur(14px)",
            borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-8 py-3 text-sm text-[#888] hover:text-white transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Search Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(10,10,10,0.96)",
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
                ✕
              </button>
            </div>
          </form>
          <p style={{ fontSize: "12px", color: "#555", marginTop: "14px", letterSpacing: "0.04em" }}>
            Try "Black Panther", "Action", "2024" · Press Enter to search
          </p>
        </div>
      </div>
    </>
  );
}
