import { ContentCopy } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';

function CopyButton({ text, label }: { text: string; label: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar('Copied', { variant: 'success' });
    } catch {
      enqueueSnackbar('Could not copy; select the text instead', { variant: 'warning' });
    }
  };
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={() => void copy()}>
        <ContentCopy fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}

/** A block of shell or JSON with a copy button in its corner. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <pre
      style={{
        position: 'relative',
        margin: 0,
        padding: '12px 40px 12px 14px',
        borderRadius: 8,
        fontSize: 12.5,
        lineHeight: 1.5,
        overflowX: 'auto',
        whiteSpace: 'pre',
        background: 'var(--code-bg, rgba(127,127,127,0.10))',
      }}
    >
      <span style={{ position: 'absolute', top: 4, right: 4 }}>
        <CopyButton text={code} label={label} />
      </span>
      {code}
    </pre>
  );
}
