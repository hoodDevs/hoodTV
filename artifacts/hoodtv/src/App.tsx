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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
