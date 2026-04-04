import { useState, useEffect, useCallback } from 'react';

const ROUTES = ['dashboard', 'library', 'upload', 'flashcards', 'settings'] as const;
type Route = typeof ROUTES[number];

function getRouteFromPath(pathname: string): Route {
  const path = pathname.replace(/^\//, '').split('/')[0] || 'dashboard';
  if (ROUTES.includes(path as Route)) {
    return path as Route;
  }
  return 'dashboard';
}

export function useRouter() {
  const [currentPage, setCurrentPage] = useState<Route>(() =>
    getRouteFromPath(window.location.pathname)
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getRouteFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((page: string) => {
    const route = ROUTES.includes(page as Route) ? page : 'dashboard';
    const newPath = route === 'dashboard' ? '/' : `/${route}`;

    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
      setCurrentPage(route as Route);
    }
  }, []);

  return { currentPage, navigate };
}
