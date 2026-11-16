// The install command with a remembered package manager. pnpm comes first.
import { useId } from 'react';
import { INSTALL_COMMANDS, PACKAGE_MANAGERS } from '../data/site.ts';
import { usePackageManager } from '../lib/packageManager.ts';
import { CopyButton } from './CopyButton.tsx';

export function InstallLine() {
  const [manager, setManager] = usePackageManager();
  const id = useId();
  const command = INSTALL_COMMANDS[manager];
  return (
    <div className="install">
      <fieldset className="pm">
        <legend className="sr">Package manager</legend>
        {PACKAGE_MANAGERS.map((name) => (
          <span key={name} className="pm-opt">
            <input
              type="radio"
              id={`${id}-${name}`}
              name={`${id}-pm`}
              value={name}
              checked={manager === name}
              onChange={() => {
                setManager(name);
              }}
            />
            <label htmlFor={`${id}-${name}`}>{name}</label>
          </span>
        ))}
      </fieldset>
      <span className="install-cmd">
        <code id={`${id}-cmd`}>{command}</code>
        <CopyButton getText={() => command} describedBy={`${id}-cmd`} onLight />
      </span>
    </div>
  );
}
