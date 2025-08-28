import { Box, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

import { TableContainer } from './TableContainer';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TableContainer> = {
  title: 'Design System/TableContainer',
  component: TableContainer,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'striped', 'bordered', 'hover'],
    },
    density: {
      control: 'select',
      options: ['compact', 'comfortable', 'spacious'],
    },
    stickyHeader: {
      control: 'boolean',
    },
    fullHeight: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TableContainer>;

// Sample data
const rows = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  firstName: `User ${i + 1}`,
  lastName: `Lastname ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ['Admin', 'Editor', 'Viewer'][Math.floor(Math.random() * 3)],
  status: ['Active', 'Inactive'][Math.floor(Math.random() * 2)],
  lastLogin: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
}));

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'firstName', headerName: 'First name', width: 130 },
  { field: 'lastName', headerName: 'Last name', width: 130 },
  { field: 'email', headerName: 'Email', width: 200 },
  { field: 'role', headerName: 'Role', width: 100 },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'lastLogin', headerName: 'Last Login', width: 180 },
];

// Basic story
export const Default: Story = {
  args: {
    variant: 'default',
    density: 'comfortable',
    fullHeight: true,
  },
  render: (args) => (
    <TableContainer {...args}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
      />
    </TableContainer>
  ),
};

// With search bar
export const WithSearchBar: Story = {
  args: {
    variant: 'hover',
    density: 'comfortable',
    fullHeight: true,
  },
  render: (args) => (
    <TableContainer 
      {...args}
      searchBar={
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search..."
            sx={{ flex: 1, maxWidth: 400 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status">
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Box>
      }
    >
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
      />
    </TableContainer>
  ),
};

// Striped variant
export const Striped: Story = {
  args: {
    variant: 'striped',
    density: 'comfortable',
    fullHeight: true,
  },
  render: (args) => (
    <TableContainer {...args}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
      />
    </TableContainer>
  ),
};

// Compact density
export const CompactDensity: Story = {
  args: {
    variant: 'hover',
    density: 'compact',
    fullHeight: true,
  },
  render: (args) => (
    <TableContainer {...args}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        density="compact"
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
      />
    </TableContainer>
  ),
};

// Fixed height
export const FixedHeight: Story = {
  args: {
    variant: 'hover',
    density: 'comfortable',
    fullHeight: false,
    height: 500,
  },
  render: (args) => (
    <TableContainer {...args}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
      />
    </TableContainer>
  ),
};