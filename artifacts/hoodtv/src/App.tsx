import { Switch, Route, Router as WouterRouter } from "wouter";
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

const queryClient = new QueryClient();

function Router() {
  return (
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
