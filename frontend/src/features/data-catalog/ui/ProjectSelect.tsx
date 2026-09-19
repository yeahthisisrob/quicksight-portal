import { FormControl, InputLabel, Link, MenuItem, Select, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { ALL_PROJECTS, type CatalogProjectOption, OUTSIDE_SMUS } from '../model/catalogState';

interface ProjectSelectProps {
  projects: CatalogProjectOption[];
  value?: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
  /** Field-first tabs can span every project; the SMUS tab cannot. */
  allowAll?: boolean;
  /** How many fields or columns sit on datasets no listing claimed. */
  outsideCount?: number;
}

/**
 * The primary control: everything in SMUS is per project (listings,
 * glossaries, form types, environments), so the catalog shows one project at
 * a time. The options are the projects selected in Settings.
 */
export function ProjectSelect({
  projects,
  value,
  onChange,
  disabled,
  allowAll,
  outsideCount,
}: ProjectSelectProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 280 }} disabled={disabled}>
      <InputLabel id="catalog-project-label">Project</InputLabel>
      <Select
        labelId="catalog-project-label"
        label="Project"
        value={value ?? (allowAll ? ALL_PROJECTS : '')}
        onChange={(e) => onChange(String(e.target.value))}
        renderValue={(selected) => {
          if (selected === ALL_PROJECTS) return 'All projects';
          if (selected === OUTSIDE_SMUS) return 'Outside SMUS';
          return projects.find((p) => p.id === selected)?.name ?? selected;
        }}
      >
        {allowAll && (
          <MenuItem value={ALL_PROJECTS}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              All projects
            </Typography>
          </MenuItem>
        )}
        {allowAll && outsideCount !== undefined && outsideCount > 0 && (
          <MenuItem value={OUTSIDE_SMUS}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              Outside SMUS
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 2 }}>
              {outsideCount}
            </Typography>
          </MenuItem>
        )}
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {project.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 2 }}>
              {project.count} {project.count === 1 ? 'asset' : 'assets'}
            </Typography>
          </MenuItem>
        ))}
      </Select>
      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
        Projects chosen in{' '}
        <Link component={RouterLink} to="/settings">
          Settings
        </Link>
      </Typography>
    </FormControl>
  );
}
