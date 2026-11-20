import { Link } from 'react-router';

/** A username linking to the public profile. `newTab` keeps the arena open during a match. */
export default function UserLink({ username, className = '', newTab = false, children }) {
  return (
    <Link
      to={`/u/${username}`}
      className={`hover:underline hover:underline-offset-2 ${className}`}
      {...(newTab && { target: '_blank', rel: 'noreferrer' })}
    >
      {children ?? username}
    </Link>
  );
}
