import {
  Box,
  TextField,
  Button,
  Stack,
  MenuItem,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import React, { useState } from 'react';

interface MetadataFormProps {
  metadata: any;
  onSave: (metadata: any) => void;
}

const dataClassificationOptions = [
  'Public',
  'Internal',
  'Confidential',
  'Restricted',
];

export default function MetadataForm({ metadata, onSave }: MetadataFormProps) {
  const [formData, setFormData] = useState({
    description: metadata.description || '',
    owner: metadata.owner || '',
    category: metadata.category || '',
    notes: metadata.notes || '',
    lastReviewed: metadata.lastReviewed ? new Date(metadata.lastReviewed) : null,
    reviewedBy: metadata.reviewedBy || '',
    businessUnit: metadata.businessUnit || '',
    dataClassification: metadata.dataClassification || '',
  });

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleDateChange = (field: string) => (date: Date | null) => {
    setFormData({
      ...formData,
      [field]: date,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      lastReviewed: formData.lastReviewed?.toISOString(),
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={3} sx={{ mt: 2 }}>
        <TextField
          label="Description"
          value={formData.description}
          onChange={handleChange('description')}
          fullWidth
          multiline
          rows={3}
        />
        
        <TextField
          label="Owner"
          value={formData.owner}
          onChange={handleChange('owner')}
          fullWidth
        />
        
        <TextField
          label="Category"
          value={formData.category}
          onChange={handleChange('category')}
          fullWidth
        />
        
        <TextField
          label="Business Unit"
          value={formData.businessUnit}
          onChange={handleChange('businessUnit')}
          fullWidth
        />
        
        <TextField
          label="Data Classification"
          value={formData.dataClassification}
          onChange={handleChange('dataClassification')}
          fullWidth
          select
        >
          <MenuItem value="">None</MenuItem>
          {dataClassificationOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        
        <DatePicker
          label="Last Reviewed"
          value={formData.lastReviewed}
          onChange={handleDateChange('lastReviewed')}
          slotProps={{ textField: { fullWidth: true } }}
        />
        
        <TextField
          label="Reviewed By"
          value={formData.reviewedBy}
          onChange={handleChange('reviewedBy')}
          fullWidth
        />
        
        <TextField
          label="Notes"
          value={formData.notes}
          onChange={handleChange('notes')}
          fullWidth
          multiline
          rows={4}
        />
        
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
        >
          Save Metadata
        </Button>
      </Stack>
    </Box>
  );
}