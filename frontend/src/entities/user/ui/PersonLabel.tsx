/**
 * A person the portal names (who started a job, archived or restored an
 * asset): their name, linked to their QuickSight user in the portal when
 * one matched, with their email on hover.
 */
import { Link, Tooltip, Typography } from '@mui/material';
import type { components } from '@shared/generated/types';
import { Link as RouterLink } from 'react-router-dom';

type Person = components['schemas']['Person'];

export function PersonLabel({
  person,
  fallback = '-',
  variant = 'body2',
}: {
  person?: Person;
  fallback?: string;
  variant?: 'body2' | 'caption';
}) {
  if (!person) {
    return (
      <Typography variant={variant} component="span" sx={{ color: 'text.secondary' }}>
        {fallback}
      </Typography>
    );
  }
  const hint = [
    person.email && person.email !== person.label ? person.email : '',
    person.quickSightUserName ? `QuickSight user ${person.quickSightUserName}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const label = person.quickSightUserName ? (
    <Link
      component={RouterLink}
      to={`/assets/users?search=${encodeURIComponent(person.quickSightUserName)}`}
      underline="hover"
      variant={variant}
      onClick={(e) => e.stopPropagation()}
    >
      {person.label}
    </Link>
  ) : (
    <Typography
      variant={variant}
      component="span"
      sx={{ color: person.kind === 'person' ? undefined : 'text.secondary' }}
    >
      {person.label}
    </Typography>
  );
  return hint ? <Tooltip title={hint}>{label}</Tooltip> : label;
}
