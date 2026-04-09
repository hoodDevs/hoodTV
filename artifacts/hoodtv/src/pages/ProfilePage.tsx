import { useLocation, Link } from "wouter";
import { Play, Trash2, Film, Tv, BookmarkCheck, Clock, BarChart2 } from "lucide-react";
import { useContinueWatching } from "@/hooks/useContinueWatching";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchProgress } from "@/hooks/useContinueWatching";

function ProgressCard({ item, onRemove }: { item: WatchProgress; onRemove: (id: string) => void }) {
  const [, setLocation] = useLocation();

  const resumeUrl = item.type === "tv"
    ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=${item.season ?? 1}&episode=${item.episode ?? 1}`
    : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  const timeAgo = (() => {
    const diff = Date.now() - (item.watchedAt ?? 0);
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  })();

  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        padding: "14px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        transition: "border-color 0.2s",
        alignItems: "center",
      }}
      className="group hover:border-[rgba(127,119,221,0.2)]"
    >
      {/* Thumbnail */}
      <Link href={`/title/${item.id}?type=${item.type}`}>
        <div
          style={{
            flexShrink: 0,
            width: "88px",
            aspectRatio: "2/3",
            borderRadius: "8px",
            overflow: "hidden",
            background: "#1a1a2e",
            position: "relative",
            cursor: "pointer",
          }}
        >
          {item.poster ? (
            <img src={item.poster} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.type === "tv" ? <Tv size={20} color="#7F77DD" opacity={0.5} /> : <Film size={20} color="#7F77DD" opacity={0.5} />}
            </div>
          )}
          {/* Progress bar on thumbnail */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: "rgba(0,0,0,0.5)" }}>
            <div style={{ height: "100%", width: `${item.progress ?? 0}%`, background: "#7F77DD" }} />
          </div>
        </div>
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/title/${item.id}?type=${item.type}`} style={{ textDecoration: "none" }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#e8e8e8", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>
            {item.title}
          </p>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", color: "#555", background: "#141414", border: "1px solid rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {item.type === "tv" ? "Series" : "Movie"}
          </span>
          {item.season !== undefined && item.episode !== undefined && (
            <span style={{ fontSize: "11px", color: "#666" }}>S{item.season} · E{item.episode}</span>
          )}
          <span style={{ fontSize: "11px", color: "#444", display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={10} /> {timeAgo}
          </span>
        </div>
        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${item.progress ?? 0}%`, background: "#7F77DD", borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: "10px", color: "#555", flexShrink: 0 }}>{Math.round(item.progress ?? 0)}%</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={() => setLocation(resumeUrl)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#7F77DD", color: "#fff",
            fontSize: "12px", fontWeight: 600,
            padding: "7px 14px", borderRadius: "7px",
            border: "none", cursor: "pointer",
            transition: "background 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#9590e8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#7F77DD"; }}
        >
          <Play size={11} fill="white" /> Resume
        </button>
        <button
          onClick={() => onRemove(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "transparent", color: "#555",
            fontSize: "12px", fontWeight: 400,
            padding: "7px 14px", borderRadius: "7px",
            border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "#e05555";
            el.style.borderColor = "rgba(224,85,85,0.25)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = "#555";
            el.style.borderColor = "rgba(255,255,255,0.06)";
          }}
        >
          <Trash2 size={11} /> Remove
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: "100px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ color, opacity: 0.8 }}>{icon}</div>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "36px", color: "#fff", lineHeight: 1, letterSpacing: "1px" }}>
        {value}
      </p>
      <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { continueWatching, removeProgress } = useContinueWatching();
  const { watchlist, removeFromWatchlist } = useWatchlist();

  const totalWatched = continueWatching.length;
  const savedCount = watchlist.length;
  const moviesWatched = continueWatching.filter((i) => i.type === "movie").length;
  const showsWatched = continueWatching.filter((i) => i.type === "tv").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", paddingBottom: "80px" }}>

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(to bottom, rgba(127,119,221,0.08) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "48px 40px 40px",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "36px" }}>
            {/* Avatar */}
            <div
              style={{
                width: "72px", height: "72px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, rgba(127,119,221,0.4) 0%, rgba(157,151,232,0.2) 100%)",
                border: "2px solid rgba(127,119,221,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "28px",
                letterSpacing: "2px",
                color: "#c0bdf5",
                boxShadow: "0 0 40px rgba(127,119,221,0.2)",
                flexShrink: 0,
              }}
            >
              HT
            </div>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", letterSpacing: "2px", color: "#fff", lineHeight: 1, marginBottom: "6px" }}>
                hoodTV Viewer
              </h1>
              <p style={{ fontSize: "13px", color: "#555", letterSpacing: "0.04em" }}>
                Your personal streaming profile
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <StatCard icon={<BarChart2 size={20} />} value={totalWatched} label="Titles Watched" color="#7F77DD" />
            <StatCard icon={<BookmarkCheck size={20} />} value={savedCount} label="Saved Titles" color="#50c098" />
            <StatCard icon={<Film size={20} />} value={moviesWatched} label="Movies" color="#e07760" />
            <StatCard icon={<Tv size={20} />} value={showsWatched} label="TV Shows" color="#5588e0" />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 40px 0" }}>

        {/* Continue Watching */}
        <section style={{ marginBottom: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "2px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "3px", height: "18px", background: "#7F77DD", borderRadius: "2px", display: "inline-block" }} />
              Continue Watching
            </h2>
            {continueWatching.length > 0 && (
              <span style={{ fontSize: "11px", color: "#555" }}>{continueWatching.length} title{continueWatching.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {continueWatching.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#444", fontSize: "14px" }}>
              <Clock size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p>Nothing in progress yet.</p>
              <p style={{ fontSize: "12px", marginTop: "6px" }}>Start watching something and it will appear here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {continueWatching.map((item) => (
                <ProgressCard key={item.id} item={item} onRemove={removeProgress} />
              ))}
            </div>
          )}
        </section>

        {/* My List */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "2px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "3px", height: "18px", background: "#50c098", borderRadius: "2px", display: "inline-block" }} />
              My List
            </h2>
            {watchlist.length > 0 && (
              <Link href="/mylist" style={{ fontSize: "11px", color: "#7F77DD", textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
                See all →
              </Link>
            )}
          </div>

          {watchlist.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#444", fontSize: "14px" }}>
              <BookmarkCheck size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p>Your list is empty.</p>
              <p style={{ fontSize: "12px", marginTop: "6px" }}>Add titles by clicking + on any movie or show.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "14px" }}>
              {watchlist.slice(0, 12).map((item) => (
                <div key={item.id} style={{ position: "relative" }}>
                  <Link href={`/title/${item.id}?type=${item.type}`}>
                    <div style={{ borderRadius: "8px", overflow: "hidden", aspectRatio: "2/3", background: "#1a1a2e", cursor: "pointer", position: "relative" }}>
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }} loading="lazy"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Film size={24} color="#7F77DD" opacity={0.4} />
                        </div>
                      )}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)", opacity: 0, transition: "opacity 0.2s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                      />
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFromWatchlist(item.id)}
                    title="Remove from list"
                    style={{
                      position: "absolute", top: "6px", right: "6px",
                      width: "22px", height: "22px",
                      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
                      border: "none", borderRadius: "50%",
                      color: "#888", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "color 0.2s, background 0.2s",
                      fontSize: "14px", lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#e05555";
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.95)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#888";
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.8)";
                    }}
                  >
                    ×
                  </button>
                  <p style={{ fontSize: "11px", color: "#888", marginTop: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
