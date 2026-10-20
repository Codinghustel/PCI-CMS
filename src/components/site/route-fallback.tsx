/** Static shell shown while a content page streams in. */
export function RouteFallback() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="h-[55vh] min-h-80 animate-pulse bg-dark" />
      <div className="container-site section-y space-y-4">
        <div className="h-8 w-1/2 animate-pulse bg-muted" />
        <div className="h-4 w-3/4 animate-pulse bg-muted" />
        <div className="h-4 w-2/3 animate-pulse bg-muted" />
      </div>
    </div>
  );
}
