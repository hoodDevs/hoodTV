import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import SearchPage from "@/pages/SearchPage";
import BrowsePage from "@/pages/BrowsePage";
import TitlePage from "@/pages/TitlePage";
import WatchPage from "@/pages/WatchPage";
import MyListPage from "@/pages/MyListPage";
import TrendingPage from "@/pages/TrendingPage";
import { Navbar, SIDEBAR_WIDTH } from "@/components/Navbar";
import { MusicPlayerProvider } from "@/music/context/MusicPlayerContext";
import { MiniPlayer } from "@/music/components/MiniPlayer";
import { MusicHomePage } from "@/music/pages/MusicHomePage";
import { ArtistPage } from "@/music/pages/ArtistPage";
import { AlbumPage } from "@/music/pages/AlbumPage";
import { GenrePage } from "@/music/pages/GenrePage";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isWatch = location.startsWith("/watch");

  if (isWatch) return <>{children}</>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ flex: 1, marginLeft: `${SIDEBAR_WIDTH}px`, minWidth: 0 }}>
        {children}
      </div>
      <MiniPlayer />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/movies">
          {() => <BrowsePage type="movies" />}
        </Route>
        <Route path="/tv">
          {() => <BrowsePage type="tv" />}
        </Route>
        <Route path="/trending" component={TrendingPage} />
        <Route path="/title/:id" component={TitlePage} />
        <Route path="/watch/:id" component={WatchPage} />
        <Route path="/mylist" component={MyListPage} />
        <Route path="/music" component={MusicHomePage} />
        <Route path="/music/artist/:id" component={ArtistPage} />
        <Route path="/music/album/:id" component={AlbumPage} />
        <Route path="/music/genre/:query" component={GenrePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MusicPlayerProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </MusicPlayerProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
