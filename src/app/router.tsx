import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { HomePage } from '@/features/trips/HomePage';
import { TripHomePage } from '@/features/trips/TripHomePage';
import { TripLayout } from '@/features/trips/TripLayout';
import { NotFound, RouteError } from '@/app/RouteError';

/**
 * Route-level code splitting: everything except the landing screens loads on demand, so the first paint only pays for
 * the shell (the map, calendar, charts and footprint map are split further inside their screens).
 */
const page = <M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: keyof M & string,
): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load())[name] as ComponentType }),
});

export const router = createBrowserRouter([
  { path: '/', element: <HomePage />, errorElement: <RouteError /> },
  {
    path: '/new',
    ...page(() => import('@/features/trips/NewTripPage'), 'NewTripPage'),
    errorElement: <RouteError />,
  },
  {
    path: '/join/:token',
    ...page(() => import('@/features/trips/JoinPage'), 'JoinPage'),
    errorElement: <RouteError />,
  },
  {
    path: '/v/:viewToken',
    ...page(() => import('@/features/share/SharedTripPage'), 'SharedTripPage'),
    errorElement: <RouteError />,
  },
  {
    path: '/t/:tripId',
    element: <TripLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <TripHomePage /> },
      { path: 'chat', ...page(() => import('@/features/chat/ChatPage'), 'ChatPage') },
      { path: 'plan', ...page(() => import('@/features/plan/PlanPage'), 'PlanPage') },
      { path: 'explore', ...page(() => import('@/features/explore/ExplorePage'), 'ExplorePage') },
      {
        path: 'reservations',
        ...page(() => import('@/features/reservations/ReservationsPage'), 'ReservationsPage'),
      },
      { path: 'files', ...page(() => import('@/features/files/FilesPage'), 'FilesPage') },
      { path: 'checklist', ...page(() => import('@/features/checklist/ChecklistPage'), 'ChecklistPage') },
      { path: 'expenses', ...page(() => import('@/features/expenses/ExpensesPage'), 'ExpensesPage') },
      { path: 'info', ...page(() => import('@/features/info/InfoPage'), 'InfoPage') },
      { path: 'offline', ...page(() => import('@/features/offline/OfflinePage'), 'OfflinePage') },
      { path: 'recap', ...page(() => import('@/features/recap/RecapPage'), 'RecapPage') },
      { path: 'members', ...page(() => import('@/features/trips/MembersPage'), 'MembersPage') },
    ],
  },
  {
    path: '/saved',
    ...page(() => import('@/features/saved/SavedPage'), 'SavedPage'),
    errorElement: <RouteError />,
  },
  {
    path: '/footprints',
    lazy: async () => ({ Component: (await import('@/features/footprints/FootprintsPage')).default }),
    errorElement: <RouteError />,
  },
  {
    path: '/settings',
    ...page(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
    errorElement: <RouteError />,
  },
  { path: '*', element: <NotFound /> },
]);
