package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	videasyReferer = "https://player.videasy.net/"
	videasyOrigin  = "https://player.videasy.net"
	defaultReferer = "https://vidlink.pro/"
	defaultOrigin  = "https://vidlink.pro"
)

var refererMap = map[string][2]string{
	"vidplus.dev":                  {videasyReferer, videasyOrigin},
	"videasy.net":                  {videasyReferer, videasyOrigin},
	"megafiles.store":              {videasyReferer, videasyOrigin},
	"serversicuro.cc":              {videasyReferer, videasyOrigin},
	"uskevinpowell89.workers.dev":  {videasyReferer, videasyOrigin},
	"fast.vidplus.dev":             {videasyReferer, videasyOrigin},
}

var client = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        300,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
	},
}

func headersFor(rawURL string) http.Header {
	h := http.Header{}
	h.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	h.Set("Accept", "*/*")
	h.Set("Accept-Language", "en-US,en;q=0.9")

	referer, origin := defaultReferer, defaultOrigin
	if parsed, err := url.Parse(rawURL); err == nil {
		host := strings.ToLower(parsed.Hostname())
		for domain, refs := range refererMap {
			if strings.Contains(host, domain) {
				referer, origin = refs[0], refs[1]
				break
			}
		}
	}
	h.Set("Referer", referer)
	h.Set("Origin", origin)
	return h
}

func isM3U8URL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	path := strings.Split(u.Path, "?")[0]
	return strings.HasSuffix(strings.ToLower(path), ".m3u8")
}

func isM3U8Content(contentType string) bool {
	ct := strings.ToLower(contentType)
	return strings.Contains(ct, "mpegurl") || strings.Contains(ct, "m3u8")
}

func isMasterPlaylist(body string) bool {
	return strings.Contains(body, "#EXT-X-STREAM-INF")
}

func isMediaPlaylist(body string) bool {
	return strings.Contains(body, "#EXTINF")
}

func guessBandwidthAndRes(rawURL string) (int, string) {
	u := strings.ToLower(rawURL)
	switch {
	case strings.Contains(u, "1080") || strings.Contains(u, "mta4ma"):
		return 4_000_000, "1920x1080"
	case strings.Contains(u, "720") || strings.Contains(u, "nziw"):
		return 2_000_000, "1280x720"
	case strings.Contains(u, "360") || strings.Contains(u, "mzyw"):
		return 800_000, "640x360"
	case strings.Contains(u, "480") || strings.Contains(u, "ndgw"):
		return 1_200_000, "854x480"
	default:
		return 2_000_000, "1280x720"
	}
}

func buildProxyURL(r *http.Request, rawURL string, asMedia bool) string {
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	host := r.Host
	suffix := ""
	if asMedia {
		suffix = "&as_media=1"
	}
	return fmt.Sprintf("%s://%s/api/proxy/hls?url=%s%s", scheme, host, url.QueryEscape(rawURL), suffix)
}

func rewriteM3U8(body, rawURL string, r *http.Request) string {
	parsed, err := url.Parse(rawURL)
	baseDomain := ""
	if err == nil {
		baseDomain = parsed.Scheme + "://" + parsed.Host
	}

	lines := strings.Split(body, "\n")
	out := make([]string, 0, len(lines))

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			out = append(out, line)
			continue
		}

		var absURL string
		switch {
		case strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://"):
			absURL = trimmed
		case strings.HasPrefix(trimmed, "//"):
			absURL = parsed.Scheme + ":" + trimmed
		case strings.HasPrefix(trimmed, "/"):
			absURL = baseDomain + trimmed
		default:
			ref, err := url.Parse(trimmed)
			if err != nil {
				out = append(out, line)
				continue
			}
			base, _ := url.Parse(rawURL)
			absURL = base.ResolveReference(ref).String()
		}
		out = append(out, "/api/proxy/hls?url="+url.QueryEscape(absURL))
	}
	return strings.Join(out, "\n")
}

func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	rawURL := r.URL.Query().Get("url")
	asMedia := r.URL.Query().Get("as_media") == "1"

	if rawURL == "" || (!strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://")) {
		http.Error(w, `{"error":"missing or invalid url parameter"}`, http.StatusBadRequest)
		return
	}

	req, err := http.NewRequest(r.Method, rawURL, nil)
	if err != nil {
		http.Error(w, `{"error":"bad upstream URL"}`, http.StatusBadRequest)
		return
	}
	req.Header = headersFor(rawURL)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[go-proxy] upstream error for %s: %v", rawURL, err)
		http.Error(w, `{"error":"upstream fetch failed"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		http.Error(w, fmt.Sprintf(`{"error":"upstream %d"}`, resp.StatusCode), resp.StatusCode)
		return
	}

	contentType := resp.Header.Get("Content-Type")
	looksM3U8 := isM3U8URL(rawURL) || isM3U8Content(contentType)

	if looksM3U8 {
		if r.Method == http.MethodHead {
			w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
			w.Header().Set("Cache-Control", "no-cache, no-store")
			w.WriteHeader(http.StatusOK)
			return
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, `{"error":"read error"}`, http.StatusInternalServerError)
			return
		}
		body := string(bodyBytes)

		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Cache-Control", "no-cache, no-store")

		if isMasterPlaylist(body) {
			rewritten := rewriteM3U8(body, rawURL, r)
			fmt.Fprint(w, rewritten)
			return
		}

		if asMedia {
			rewritten := rewriteM3U8(body, rawURL, r)
			fmt.Fprint(w, rewritten)
			return
		}

		if isMediaPlaylist(body) {
			mediaProxyURL := "/api/proxy/hls?url=" + url.QueryEscape(rawURL) + "&as_media=1"
			bw, res := guessBandwidthAndRes(rawURL)
			master := fmt.Sprintf(
				"#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%s\n%s\n",
				bw, res, mediaProxyURL,
			)
			fmt.Fprint(w, master)
			return
		}

		fmt.Fprint(w, body)
		return
	}

	path := strings.ToLower(strings.Split(rawURL, "?")[0])
	switch {
	case strings.HasSuffix(path, ".ts"):
		w.Header().Set("Content-Type", "video/mp2t")
	case strings.HasSuffix(path, ".vtt"):
		w.Header().Set("Content-Type", "text/vtt")
	case strings.HasSuffix(path, ".key"):
		w.Header().Set("Content-Type", "application/octet-stream")
	default:
		if contentType != "" {
			w.Header().Set("Content-Type", contentType)
		} else {
			w.Header().Set("Content-Type", "video/mp2t")
		}
	}
	w.Header().Set("Cache-Control", "max-age=3600")

	if r.Method != http.MethodHead {
		written, err := io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("[go-proxy] copy error after %d bytes: %v", written, err)
		}
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","service":"go-proxy","version":"1.0.0","language":"Go"}`)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/proxy/hls", proxyHandler)
	mux.HandleFunc("/proxy/hls", proxyHandler)
	mux.HandleFunc("/health", healthHandler)

	log.Printf("[go-proxy] hoodTV Go HLS Proxy starting on :%s", port)
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("[go-proxy] fatal: %v", err)
	}
}
