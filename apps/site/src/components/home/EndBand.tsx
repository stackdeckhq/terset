// The closing section: install, try it, or take the agent prompt.
import { Link } from '@tanstack/react-router';
import { ArrowIcon } from '../Icons.tsx';
import { InstallLine } from '../InstallLine.tsx';

export function EndBand() {
  return (
    <section className="step end" id="start" aria-labelledby="h-end">
      <h2 id="h-end">Try it on your own rows.</h2>
      <InstallLine />
      <div className="actions">
        <Link to="/" hash="b2" className="btn btn-lg btn-primary">
          Try your JSON <ArrowIcon />
        </Link>
        <Link to="/" hash="b8" className="btn btn-lg btn-line">
          Get the agent prompt
        </Link>
      </div>
    </section>
  );
}
