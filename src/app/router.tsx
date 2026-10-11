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
      { path: 'chat', element: <Placeholder title={r.chat} /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'explore', element: <Placeholder title={r.explore} /> },
      { path: 'reservations', element: <Placeholder title={r.reservations} /> },
      { path: 'files', element: <Placeholder title={r.files} /> },
      { path: 'checklist', element: <ChecklistPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'members', element: <MembersPage /> },
    ],
  },
  { path: '/footprints', element: <Placeholder title={r.footprints} /> },
  { path: '/settings', element: <Placeholder title={r.settings} /> },
  { path: '*', element: <Placeholder title={r.notFound} /> },
]);
