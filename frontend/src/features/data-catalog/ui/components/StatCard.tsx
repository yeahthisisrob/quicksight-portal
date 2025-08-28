/**
 * Reusable StatCard component for displaying metrics
 */
import { Card, CardContent, Typography, Box, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

export function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <Card 
      sx={{ 
        height: '100%', 
        position: 'relative', 
        overflow: 'visible',
        borderRadius: `${spacing.sm / 8}px`,
        border: `1px solid ${colors.neutral[200]}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3),
        },
      }}
    >
      <CardContent sx={{ p: spacing.md / 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.sm / 8 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: `${spacing.sm / 8}px`,
              background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.2)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: spacing.md / 8,
              boxShadow: `0 2px 8px ${alpha(color, 0.2)}`,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              color="text.secondary" 
              variant="caption" 
              display="block"
              sx={{ 
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 0.5,
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {subtitle && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: colors.neutral[600],
                  fontSize: '0.75rem',
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}