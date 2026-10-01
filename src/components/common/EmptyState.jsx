// A simple empty-state row with optional CTA. Used by list pages when an
// API returns [] or we want a friendly "nothing here yet" hint.

export default function EmptyState({ title, message, action }) {
  return (
    <div className="text-center py-5">
      <h5 className="mb-2">{title}</h5>
      {message ? <p className="text-muted mb-3">{message}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
