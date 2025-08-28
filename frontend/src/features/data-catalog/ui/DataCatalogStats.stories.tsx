import DataCatalogStats from './DataCatalogStats';

import type { DataCatalogSummary, VisualFieldSummary, SemanticStats } from '../model/types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataCatalog/DataCatalogStats',
  component: DataCatalogStats,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Statistics cards for the data catalog, displaying different metrics based on the selected view mode. Features modern card designs with gradients, hover effects, and data visualization.',
      },
    },
  },
  argTypes: {
    viewMode: {
      control: { type: 'select' },
      options: ['physical', 'semantic', 'mapping', 'visual-fields', 'calculated'],
      description: 'The view mode determining which statistics to display',
    },
    stats: {
      description: 'Semantic statistics data',
    },
    catalogSummary: {
      description: 'Catalog summary data for physical and calculated views',
    },
    visualFieldSummary: {
      description: 'Visual field summary data',
    },
  },
} satisfies Meta<typeof DataCatalogStats>;

export default meta;
type Story = StoryObj<typeof meta>;

const physicalSummary: DataCatalogSummary = {
  totalFields: 1247,
  distinctFields: 892,
  visualFields: 456,
  totalCalculatedFields: 234,
  calculatedDatasetFields: 145,
  calculatedAnalysisFields: 89,
  fieldsWithVariants: 45,
  fieldsWithComments: 89,
  avgExpressionLength: 127,
  fieldsByDataType: {
    STRING: 412,
    INTEGER: 234,
    DECIMAL: 156,
    DATETIME: 89,
    BOOLEAN: 45,
    Unknown: 12,
  },
};

const semanticStats: SemanticStats = {
  totalTerms: 156,
  mappedFields: 892,
  unmappedFields: 355,
  coverage: 72,
};

const visualFieldSummary: VisualFieldSummary = {
  totalFields: 456,
  mappingsByAssetType: {
    dashboards: 312,
    analyses: 144,
  },
  mappingsByVisualType: {
    barChart: 89,
    lineChart: 67,
    pieChart: 45,
    table: 156,
    kpi: 34,
    heatmap: 23,
    scatter: 42,
  },
};

const calculatedSummary: DataCatalogSummary = {
  totalFields: 1247,
  distinctFields: 892,
  visualFields: 456,
  totalCalculatedFields: 234,
  calculatedDatasetFields: 145,
  calculatedAnalysisFields: 89,
  fieldsWithVariants: 45,
  fieldsWithComments: 89,
  avgExpressionLength: 127,
  fieldsByDataType: {},
};

export const PhysicalViewStats: Story = {
  args: {
    viewMode: 'physical',
    catalogSummary: physicalSummary,
  },
  parameters: {
    docs: {
      description: {
        story: 'Statistics for physical fields view, showing field counts, data type distribution, and calculated field breakdown.',
      },
    },
  },
};

export const SemanticViewStats: Story = {
  args: {
    viewMode: 'semantic',
    stats: semanticStats,
  },
  parameters: {
    docs: {
      description: {
        story: 'Statistics for semantic view, displaying term counts, mapping coverage, and field mapping status.',
      },
    },
  },
};

export const VisualFieldsViewStats: Story = {
  args: {
    viewMode: 'visual-fields',
    visualFieldSummary: visualFieldSummary,
  },
  parameters: {
    docs: {
      description: {
        story: 'Statistics for visual fields view, showing field distribution across dashboards and analyses.',
      },
    },
  },
};

export const CalculatedViewStats: Story = {
  args: {
    viewMode: 'calculated',
    catalogSummary: calculatedSummary,
  },
  parameters: {
    docs: {
      description: {
        story: 'Statistics for calculated fields view, showing expression metrics and variant analysis.',
      },
    },
  },
};

export const EmptyStats: Story = {
  args: {
    viewMode: 'physical',
    catalogSummary: {
      totalFields: 0,
      distinctFields: 0,
      visualFields: 0,
      totalCalculatedFields: 0,
      calculatedDatasetFields: 0,
      calculatedAnalysisFields: 0,
      fieldsWithVariants: 0,
      fieldsWithComments: 0,
      avgExpressionLength: 0,
      fieldsByDataType: {},
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state statistics when no data is available.',
      },
    },
  },
};

// Additional comprehensive stories
export const LargeDatasetStats: Story = {
  args: {
    viewMode: 'physical',
    catalogSummary: {
      totalFields: 125000,
      distinctFields: 98765,
      visualFields: 45678,
      totalCalculatedFields: 12345,
      calculatedDatasetFields: 8901,
      calculatedAnalysisFields: 3444,
      fieldsWithVariants: 2345,
      fieldsWithComments: 9876,
      avgExpressionLength: 234,
      fieldsByDataType: {
        STRING: 45678,
        INTEGER: 23456,
        DECIMAL: 12345,
        DATETIME: 9876,
        BOOLEAN: 5432,
        Unknown: 2978,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Statistics for a large dataset with thousands of fields.',
      },
    },
  },
};

export const HighCoverageSemantics: Story = {
  args: {
    viewMode: 'semantic',
    stats: {
      totalTerms: 500,
      mappedFields: 495,
      unmappedFields: 5,
      coverage: 99,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Semantic view with excellent mapping coverage (99%).',
      },
    },
  },
};

export const LowCoverageSemantics: Story = {
  args: {
    viewMode: 'semantic',
    stats: {
      totalTerms: 500,
      mappedFields: 125,
      unmappedFields: 375,
      coverage: 25,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Semantic view with poor mapping coverage (25%), indicating need for improvement.',
      },
    },
  },
};

export const RichVisualFieldsStats: Story = {
  args: {
    viewMode: 'visual-fields',
    visualFieldSummary: {
      totalFields: 3456,
      mappingsByAssetType: {
        dashboards: 2345,
        analyses: 1111,
      },
      mappingsByVisualType: {
        BarChart: 456,
        LineChart: 389,
        PieChart: 234,
        Table: 345,
        KPIVisual: 178,
        HeatMap: 167,
        ScatterPlot: 156,
        TreeMap: 145,
        Histogram: 134,
        BoxPlot: 123,
        Waterfall: 112,
        FunnelChart: 101,
        GaugeChart: 90,
        SankeyDiagram: 89,
        WordCloud: 78,
        GeospatialMap: 67,
        PivotTable: 56,
        Donut: 45,
        ComboChart: 34,
        RadarChart: 23,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Visual fields with extensive variety of visualization types.',
      },
    },
  },
};

export const WellDocumentedCalculated: Story = {
  args: {
    viewMode: 'calculated',
    catalogSummary: {
      totalFields: 1000,
      distinctFields: 1000,
      visualFields: 0,
      totalCalculatedFields: 500,
      calculatedDatasetFields: 300,
      calculatedAnalysisFields: 200,
      fieldsWithVariants: 25,
      fieldsWithComments: 475,
      avgExpressionLength: 89,
      fieldsByDataType: {},
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Calculated fields with excellent documentation (95% have comments).',
      },
    },
  },
};

export const ComplexCalculated: Story = {
  args: {
    viewMode: 'calculated',
    catalogSummary: {
      totalFields: 500,
      distinctFields: 500,
      visualFields: 0,
      totalCalculatedFields: 200,
      calculatedDatasetFields: 120,
      calculatedAnalysisFields: 80,
      fieldsWithVariants: 150,
      fieldsWithComments: 50,
      avgExpressionLength: 456,
      fieldsByDataType: {},
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Calculated fields with complex expressions and many variants.',
      },
    },
  },
};