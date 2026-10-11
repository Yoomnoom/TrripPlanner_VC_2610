import { createBrowserRouter } from 'react-router-dom';
import { Placeholder } from '@/app/Placeholder';
import { copy } from '@/copy';

const r = copy.routes;

export const router = createBrowserRouter([
  { path: '/', element: <Placeholder title={r.home} /> },
  { path: '/new', element: <Placeholder title={r.newTrip} /> },
  { path: '/join/:token', element: <Placeholder title={r.join} /> },
  { path: '/t/:tripId', element: <Placeholder title={r.tripHome} /> },
  { path: '/t/:tripId/chat', element: <Placeholder title={r.chat} /> },
  { path: '/t/:tripId/plan', element: <Placeholder title={r.plan} /> },
  { path: '/t/:tripId/explore', element: <Placeholder title={r.explore} /> },
  { path: '/t/:tripId/reservations', element: <Placeholder title={r.reservations} /> },
  { path: '/t/:tripId/files', element: <Placeholder title={r.files} /> },
  { path: '/t/:tripId/checklist', element: <Placeholder title={r.checklist} /> },
  { path: '/t/:tripId/expenses', element: <Placeholder title={r.expenses} /> },
  { path: '/t/:tripId/members', element: <Placeholder title={r.members} /> },
  { path: '/footprints', element: <Placeholder title={r.footprints} /> },
  { path: '/settings', element: <Placeholder title={r.settings} /> },
  { path: '*', element: <Placeholder title={r.notFound} /> },
]);