import { Chip } from '@mui/material';

interface Folder {
  id: string;
  name: string;
  path: string;
}

interface FoldersCellProps {
  folders: Folder[];
  folderCount?: number;
  onClick?: () => void;
}

export default function FoldersCell({ folders, folderCount, onClick }: FoldersCellProps) {
  const count = folderCount ?? folders?.length ?? 0;

  return (
    <Chip 
      label={count} 
      size="small" 
      color={count > 0 ? 'primary' : 'default'}
      sx={{ 
        cursor: count > 0 ? 'pointer' : 'default',
        '&:hover': count > 0 ? { 
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
        } : {}
      }}
      onClick={count > 0 ? onClick : undefined}
    />
  );
}