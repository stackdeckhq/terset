// The 404 page. Only this page carries noindex; React moves the meta into the head.
import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <section className="lost" aria-labelledby="h-lost">
      <meta name="robots" content="noindex" />
      <p className="code-n">404</p>
      <h1 id="h-lost">This page is not here.</h1>
      <p>The link may be old, or the address has a typo.</p>
      <div className="actions">
        <Link to="/" className="btn btn-primary">
          Go to the home page
        </Link>
        <Link to="/format" className="btn btn-line">
          Read the format
        </Link>
      </div>
    </section>
  );
}
