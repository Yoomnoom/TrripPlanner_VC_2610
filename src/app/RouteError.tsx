import { Link, useRouteError } from 'react-router-dom';
import { copy } from '@/copy';
import { btn } from '@/components/styles';

/** Error screen for any route (failed chunk load, render error). Never a blank page. */
export function RouteError() {
  const error = useRouteError();
  // a stale deployment can leave the browser asking for a chunk that no longer exists: a reload fixes it
  const chunk =
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message);
  return (
    <main className="mx-auto grid max-w-md gap-3 p-8 text-center" role="alert">
      <h1 className="text-xl font-bold">{chunk ? copy.errors.updated : copy.errors.title}</h1>
      <p className="text-muted">{chunk ? copy.errors.updatedBody : copy.errors.body}</p>
      <div className="flex justify-center gap-2">
        <button type="button" className={btn.primary} onClick={() => window.location.reload()}>
          {copy.errors.reload}
        </button>
        <Link to="/" className={btn.ghost}>
          {copy.join.goHome}
        </Link>
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
      <h1 className="text-xl font-bold">{copy.routes.notFound}</h1>
      <Link to="/" className={`${btn.primary} mx-auto`}>
        {copy.join.goHome}
      </Link>
    </main>
  );
}
