import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Paper,
  IconButton,
} from '@mui/material';
import React from 'react';

import { functionCategories, getDocLink } from '@/shared/lib/functionCategories';
import { getDependencyChain, CalculatedFieldForGraph } from '@/shared/lib/graphUtils';

interface ExpressionGraphDialogProps {
  field: CalculatedFieldForGraph | null;
  allFields: CalculatedFieldForGraph[];
  open: boolean;
  onClose: () => void;
}

const wrapFunctionsWithLinks = (expression: string): React.ReactNode[] => {
  if (!expression || typeof expression !== 'string') {
    return [];
  }
  
  const functionPattern = /\b(\w+)\s*(\()/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = functionPattern.exec(expression)) !== null) {
    const [, funcName, parenthesis] = match;
    const index = match.index;

    if (index > lastIndex) {
      parts.push(expression.substring(lastIndex, index));
    }

    const funcKey = funcName.toUpperCase();
    const standardFunction = functionCategories[funcKey]?.standardFunction;

    if (standardFunction) {
      const docLink = getDocLink(standardFunction);
      if (docLink) {
        parts.push(
          <a
            key={index}
            href={docLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#0073bb",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            {funcName}
          </a>,
        );
      } else {
        parts.push(funcName);
      }
    } else {
      parts.push(funcName);
    }

    parts.push(parenthesis);
    lastIndex = functionPattern.lastIndex;
  }

  if (lastIndex < expression.length) {
    parts.push(expression.substring(lastIndex));
  }

  return parts;
};

const DependencyItem: React.FC<{ item: any; isLast: boolean }> = ({
  item,
  isLast,
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      ml: item.level * 3,
      mb: isLast ? 0 : 2,
      position: "relative",
      "&::before": {
        content: '""',
        position: "absolute",
        left: "-16px",
        top: "50%",
        width: "16px",
        height: "1px",
        bgcolor: "primary.light",
      },
      "&::after": {
        content: '""',
        position: "absolute",
        left: "-16px",
        top: "0",
        bottom: isLast ? "50%" : "0",
        width: "1px",
        bgcolor: "primary.light",
      },
    }}
  >
    <Paper
      elevation={3}
      sx={{
        p: 2,
        width: "calc(100% - 16px)",
        border: "1px solid",
        borderColor: "primary.light",
        borderRadius: "8px",
        transition: "box-shadow 0.3s",
        "&:hover": {
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        },
      }}
    >
      <Typography
        variant="subtitle1"
        fontWeight="bold"
        color="primary.main"
        gutterBottom
      >
        {item.alias}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
      >
        {item.expression ? wrapFunctionsWithLinks(item.expression) : 'No expression available'}
      </Typography>
    </Paper>
  </Box>
);

const ExpressionGraphDialog: React.FC<ExpressionGraphDialogProps> = ({
  field,
  open,
  onClose,
  allFields,
}) => {
  
  const expressionChain = field && field.expression
    ? getDependencyChain(field, allFields)
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "800px",
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 3,
          backgroundColor: "primary.main",
          color: "white",
          pr: "48px",
        }}
      >
        Expression Dependency Chain: {field?.fieldName}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "white",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 4,
          backgroundColor: "#f5f5f5",
          overflowX: "hidden",
        }}
      >
        {field && field.expression && expressionChain.length > 0 ? (
          <Box sx={{ position: "relative", pl: 3, pr: 1 }}>
            {expressionChain.map((item, index) => (
              <DependencyItem
                key={`${item.alias}-${index}`}
                item={item}
                isLast={index === expressionChain.length - 1}
              />
            ))}
          </Box>
        ) : (
          <Typography>
            {!field ? 'No field selected.' : !field.expression ? 'No expression available for this field.' : 'No dependencies found for this calculated field.'}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExpressionGraphDialog;