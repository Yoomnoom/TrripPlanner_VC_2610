import { createBrowserRouter } from 'react-router-dom';
import { Placeholder } from '@/app/Placeholder';
import { HomePage } from '@/features/trips/HomePage';
import { JoinPage } from '@/features/trips/JoinPage';
import { MembersPage } from '@/features/trips/MembersPage';
import { NewTripPage } from '@/features/trips/NewTripPage';
import { TripHomePage } from '@/features/trips/TripHomePage';
import { TripLayout } from '@/features/trips/TripLayout';
import { PlanPage } from '@/features/plan/PlanPage';
import { ChecklistPage } from '@/features/checklist/ChecklistPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { ExplorePage } from '@/features/explore/ExplorePage';
import { FilesPage } from '@/features/files/FilesPage';
import { ReservationsPage } from '@/features/reservations/ReservationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SavedPage } from '@/features/saved/SavedPage';
import { copy } from '@/copy';

const r = copy.routes;

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/new', element: <NewTripPage /> },
  { path: '/join/:token', element: <JoinPage /> },
  {
    path: '/t/:tripId',
    element: <TripLayout />,
    children: [
      { index: true, element: <TripHomePage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'reservations', element: <ReservationsPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'checklist', element: <ChecklistPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'members', element: <MembersPage /> },
    ],
  },
  {
    path: '/footprints',
    lazy: async () => ({ Component: (await import('@/features/footprints/FootprintsPage')).default }),
  },
  { path: '/saved', element: <SavedPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '*', element: <Placeholder title={r.notFound} /> },
]);
