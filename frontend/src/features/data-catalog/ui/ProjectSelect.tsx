import { FormControl, InputLabel, Link, MenuItem, Select, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import type { CatalogProjectOption } from '../model/catalogState';

interface ProjectSelectProps {
  projects: CatalogProjectOption[];
  value?: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}

/**
 * The primary control: everything in SMUS is per project (listings,
 * glossaries, form types, environments), so the catalog shows one project at
 * a time. The options are the projects selected in Settings.
 */
export function ProjectSelect({ projects, value, onChange, disabled }: ProjectSelectProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 280 }} disabled={disabled}>
      <InputLabel id="catalog-project-label">Project</InputLabel>
      <Select
        labelId="catalog-project-label"
        label="Project"
        value={value ?? ''}
        onChange={(e) => onChange(String(e.target.value))}
        renderValue={(selected) => projects.find((p) => p.id === selected)?.name ?? selected}
      >
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
