// functionCategories.ts
export const functionCategories: {
  [key: string]: { standardFunction: string; category: string; cost: number; isLAC?: boolean};
} = {
// Aggregate Functions
  'AVG': { standardFunction: 'avg', category: 'Aggregate Functions', cost: 5 },
  'AVG_IF': { standardFunction: 'avgIf', category: 'Aggregate Functions', cost: 6 },
  'COUNT': { standardFunction: 'count', category: 'Aggregate Functions', cost: 3 },
  'COUNT_IF': { standardFunction: 'countIf', category: 'Aggregate Functions', cost: 4 },
  'DISTINCT_COUNT': { standardFunction: 'distinct_count', category: 'Aggregate Functions', cost: 10 },
  'DISTINCT_COUNT_IF': { standardFunction: 'distinct_countIf', category: 'Aggregate Functions', cost: 11 },
  'MAX': { standardFunction: 'max', category: 'Aggregate Functions', cost: 4 },
  'MAX_IF': { standardFunction: 'maxIf', category: 'Aggregate Functions', cost: 5 },
  'MEDIAN': { standardFunction: 'median', category: 'Aggregate Functions', cost: 6 },
  'MEDIAN_IF': { standardFunction: 'medianIf', category: 'Aggregate Functions', cost: 7 },
  'MIN': { standardFunction: 'min', category: 'Aggregate Functions', cost: 4 },
  'MIN_IF': { standardFunction: 'minIf', category: 'Aggregate Functions', cost: 5 },
  'PERCENTILE_DISC': { standardFunction: 'percentileDisc', category: 'Aggregate Functions', cost: 8 },
  'PERCENTILE_CONT': { standardFunction: 'percentileCont', category: 'Aggregate Functions', cost: 8 },
  'SUM': { standardFunction: 'sum', category: 'Aggregate Functions', cost: 5 },
  'SUM_IF': { standardFunction: 'sumIf', category: 'Aggregate Functions', cost: 6 },
  'STDEV': { standardFunction: 'stdev', category: 'Aggregate Functions', cost: 6 },
  'STDEV_IF': { standardFunction: 'stdevIf', category: 'Aggregate Functions', cost: 7 },
  'STDEVP': { standardFunction: 'stdevp', category: 'Aggregate Functions', cost: 6 },
  'STDEVP_IF': { standardFunction: 'stdevpIf', category: 'Aggregate Functions', cost: 7 },
  'VAR': { standardFunction: 'var', category: 'Aggregate Functions', cost: 6 },
  'VAR_IF': { standardFunction: 'varIf', category: 'Aggregate Functions', cost: 7 },
  'VARP': { standardFunction: 'varp', category: 'Aggregate Functions', cost: 6 },
  'VARP_IF': { standardFunction: 'varpIf', category: 'Aggregate Functions', cost: 7 },
  'PERIOD_TO_DATE_AVG': { standardFunction: 'periodToDateAvg', category: 'Aggregate Functions', cost: 9 },
  'PERIOD_TO_DATE_COUNT': { standardFunction: 'periodToDateCount', category: 'Aggregate Functions', cost: 8 },
  'PERIOD_TO_DATE_MAX': { standardFunction: 'periodToDateMax', category: 'Aggregate Functions', cost: 8 },
  'PERIOD_TO_DATE_MEDIAN': { standardFunction: 'periodToDateMedian', category: 'Aggregate Functions', cost: 9 },
  'PERIOD_TO_DATE_MIN': { standardFunction: 'periodToDateMin', category: 'Aggregate Functions', cost: 8 },
  'PERIOD_TO_DATE_PERCENTILE': { standardFunction: 'periodToDatePercentile', category: 'Aggregate Functions', cost: 10 },
  'PERIOD_TO_DATE_PERCENTILE_CONT': { standardFunction: 'periodToDatePercentileCont', category: 'Aggregate Functions', cost: 10 },
  'PERIOD_TO_DATE_STDEV': { standardFunction: 'periodToDateStDev', category: 'Aggregate Functions', cost: 9 },
  'PERIOD_TO_DATE_STDEVP': { standardFunction: 'periodToDateStDevP', category: 'Aggregate Functions', cost: 9 },
  'PERIOD_TO_DATE_SUM': { standardFunction: 'periodToDateSum', category: 'Aggregate Functions', cost: 8 },
  'PERIOD_TO_DATE_VAR': { standardFunction: 'periodToDateVar', category: 'Aggregate Functions', cost: 9 },
  'PERIOD_TO_DATE_VARP': { standardFunction: 'periodToDateVarP', category: 'Aggregate Functions', cost: 9 },

  // _LACA Suffix Functions
  'AVG_LACA': { standardFunction: 'avg', category: 'Aggregate Functions', cost: 7, isLAC: true},
  'COUNT_LACA': { standardFunction: 'count', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'DISTINCT_COUNT_LACA': { standardFunction: 'distinctCount', category: 'Aggregate Functions', cost: 12, isLAC: true },
  'MAX_LACA': { standardFunction: 'max', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'MEDIAN_LACA': { standardFunction: 'median', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'MIN_LACA': { standardFunction: 'min', category: 'Aggregate Functions', cost: 7, isLAC: true  },
  'PERCENTILE_DISC_LACA': { standardFunction: 'percentileDisc', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'PERCENTILE_CONT_LACA': { standardFunction: 'percentileCont', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'SUM_LACA': { standardFunction: 'sum', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'STDEV_LACA': { standardFunction: 'stdev', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'STDEVP_LACA': { standardFunction: 'stdevp', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'VAR_LACA': { standardFunction: 'var', category: 'Aggregate Functions', cost: 7, isLAC: true },
  'VARP_LACA': { standardFunction: 'varp', category: 'Aggregate Functions', cost: 7, isLAC: true },

  // Conditional Functions
  'COALESCE': { standardFunction: 'coalesce', category: 'Conditional Functions', cost: 2 },
  'IFELSE': { standardFunction: 'ifelse', category: 'Conditional Functions', cost: 2 },
  'IN': { standardFunction: 'in', category: 'Conditional Functions', cost: 3 },
  'ISNOTNULL': { standardFunction: 'isNotNull', category: 'Conditional Functions', cost: 1 },
  'ISNULL': { standardFunction: 'isNull', category: 'Conditional Functions', cost: 1 },
  'NOTIN': { standardFunction: 'notIn', category: 'Conditional Functions', cost: 3 },
  'NULLIF': { standardFunction: 'nullIf', category: 'Conditional Functions', cost: 2 },
  'SWITCH': { standardFunction: 'switch', category: 'Conditional Functions', cost: 3 },

  // Date Functions
  'ADDDATETIME': { standardFunction: 'addDateTime', category: 'Date Functions', cost: 4 },
  'ADDWORKDAYS': { standardFunction: 'addWorkDays', category: 'Date Functions', cost: 7 },
  'DATEDIFF': { standardFunction: 'dateDiff', category: 'Date Functions', cost: 4 },
  'EPOCHDATE': { standardFunction: 'epochDate', category: 'Date Functions', cost: 3 },
  'EXTRACT': { standardFunction: 'extract', category: 'Date Functions', cost: 3 },
  'FORMATDATE': { standardFunction: 'formatDate', category: 'Date Functions', cost: 3 },
  'ISWORKDAY': { standardFunction: 'isWorkDay', category: 'Date Functions', cost: 3 },
  'NETWORKDAYS': { standardFunction: 'netWorkDays', category: 'Date Functions', cost: 7 },
  'NOW': { standardFunction: 'now', category: 'Date Functions', cost: 2 },
  'TRUNCDATE': { standardFunction: 'truncDate', category: 'Date Functions', cost: 3 },

  // Numeric Functions
  'CEIL': { standardFunction: 'ceil', category: 'Numeric Functions', cost: 2 },
  'DECIMALTOINT': { standardFunction: 'decimalToInt', category: 'Numeric Functions', cost: 2 },
  'FLOOR': { standardFunction: 'floor', category: 'Numeric Functions', cost: 2 },
  'INTTODECIMAL': { standardFunction: 'intToDecimal', category: 'Numeric Functions', cost: 2 },
  'ROUND': { standardFunction: 'round', category: 'Numeric Functions', cost: 2 },

  // Mathematical Functions
  'ABS': { standardFunction: 'abs', category: 'Mathematical Functions', cost: 2 },
  'EXP': { standardFunction: 'exp', category: 'Mathematical Functions', cost: 3 },
  'LN': { standardFunction: 'ln', category: 'Mathematical Functions', cost: 3 },
  'LOG': { standardFunction: 'log', category: 'Mathematical Functions', cost: 3 },
  'MOD': { standardFunction: 'mod', category: 'Mathematical Functions', cost: 2 },
  'SQRT': { standardFunction: 'sqrt', category: 'Mathematical Functions', cost: 3 },

  // String Functions
  'CONCAT': { standardFunction: 'concat', category: 'String Functions', cost: 2 },
  'CONTAINS': { standardFunction: 'contains', category: 'String Functions', cost: 3 },
  'ENDSWITH': { standardFunction: 'endsWith', category: 'String Functions', cost: 2 },
  'LEFT': { standardFunction: 'left', category: 'String Functions', cost: 2 },
  'LOCATE': { standardFunction: 'locate', category: 'String Functions', cost: 2 },
  'LTRIM': { standardFunction: 'ltrim', category: 'String Functions', cost: 2 },
  'PARSEDATE': { standardFunction: 'parseDate', category: 'String Functions', cost: 4 },
  'PARSEDECIMAL': { standardFunction: 'parseDecimal', category: 'String Functions', cost: 2 },
  'PARSEINT': { standardFunction: 'parseInt', category: 'String Functions', cost: 2 },
  'PARSEJSON': { standardFunction: 'parseJson', category: 'String Functions', cost: 5 },
  'REPLACE': { standardFunction: 'replace', category: 'String Functions', cost: 3 },
  'RIGHT': { standardFunction: 'right', category: 'String Functions', cost: 2 },
  'RTRIM': { standardFunction: 'rtrim', category: 'String Functions', cost: 2 },
  'SPLIT': { standardFunction: 'split', category: 'String Functions', cost: 3 },
  'STARTSWITH': { standardFunction: 'startsWith', category: 'String Functions', cost: 2 },
  'STRLEN': { standardFunction: 'strlen', category: 'String Functions', cost: 2 },
  'SUBSTRING': { standardFunction: 'substring', category: 'String Functions', cost: 2 },
  'TODATE': { standardFunction: 'toDate', category: 'String Functions', cost: 3 },
  'TOLOWER': { standardFunction: 'toLower', category: 'String Functions', cost: 2 },
  'TOSTRING': { standardFunction: 'toString', category: 'String Functions', cost: 2 },
  'TOUPPER': { standardFunction: 'toUpper', category: 'String Functions', cost: 2 },
  'TRIM': { standardFunction: 'trim', category: 'String Functions', cost: 2 },

  // Table Calculation Functions
  'AVGOVER': { standardFunction: 'avgOver', category: 'Table Calculation Functions', cost: 8 },
  'COUNTOVER': { standardFunction: 'countOver', category: 'Table Calculation Functions', cost: 8 },
  'DENSERANK': { standardFunction: 'denseRank', category: 'Table Calculation Functions', cost: 9 },
  'DISTINCTCOUNTOVER': { standardFunction: 'distinctCountOver', category: 'Table Calculation Functions', cost: 10 },
  'LAG': { standardFunction: 'lag', category: 'Table Calculation Functions', cost: 7 },
  'LEAD': { standardFunction: 'lead', category: 'Table Calculation Functions', cost: 7 },
  'MAXOVER': { standardFunction: 'maxOver', category: 'Table Calculation Functions', cost: 8 },
  'MINOVER': { standardFunction: 'minOver', category: 'Table Calculation Functions', cost: 8 },
  'PERCENTILE': { standardFunction: 'percentile', category: 'Table Calculation Functions', cost: 9 },
  'PERCENTILERANK': { standardFunction: 'percentileRank', category: 'Table Calculation Functions', cost: 9 },
  'RANK': { standardFunction: 'rank', category: 'Table Calculation Functions', cost: 9 },
  'RUNNINGAVG': { standardFunction: 'runningAvg', category: 'Table Calculation Functions', cost: 7 },
  'RUNNINGCOUNT': { standardFunction: 'runningCount', category: 'Table Calculation Functions', cost: 6 },
  'RUNNINGMAX': { standardFunction: 'runningMax', category: 'Table Calculation Functions', cost: 7 },
  'RUNNINGMIN': { standardFunction: 'runningMin', category: 'Table Calculation Functions', cost: 7 },
  'RUNNINGSUM': { standardFunction: 'runningSum', category: 'Table Calculation Functions', cost: 7 },
  'STDEVOVER': { standardFunction: 'stdevOver', category: 'Table Calculation Functions', cost: 9 },
  'STDEVPOVER': { standardFunction: 'stdevpOver', category: 'Table Calculation Functions', cost: 9 },
  'SUMOVER': { standardFunction: 'sumOver', category: 'Table Calculation Functions', cost: 8 },
  'VAROVER': { standardFunction: 'varOver', category: 'Table Calculation Functions', cost: 9 },
  'VARPOVER': { standardFunction: 'varpOver', category: 'Table Calculation Functions', cost: 9 },
  'WINDOWAVG': { standardFunction: 'windowAvg', category: 'Table Calculation Functions', cost: 8 },
  'WINDOWCOUNT': { standardFunction: 'windowCount', category: 'Table Calculation Functions', cost: 8 },
  'WINDOWMAX': { standardFunction: 'windowMax', category: 'Table Calculation Functions', cost: 8 },
  'WINDOWMIN': { standardFunction: 'windowMin', category: 'Table Calculation Functions', cost: 8 },
  'WINDOWSUM': { standardFunction: 'windowSum', category: 'Table Calculation Functions', cost: 8 },
};

export const getFunctionCategoryAndCost = (
  func: string,
): { category: string; cost: number } => {
  const functionName = func.split("(")[0].toUpperCase(); // Ensure case insensitivity
  const lowerCaseCategories = Object.keys(functionCategories).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = functionCategories[key];
      return acc;
    },
    {} as { [key: string]: { category: string; cost: number } },
  );

  return (
    lowerCaseCategories[functionName] || {
      category: "Unknown Category",
      cost: 1,
    }
  );
};

const lacFunctions = [
  'avg',
  'count',
  'distinct_count',
  'max',
  'median',
  'min',
  'percentile',
  'percentileCont',
  'percentileDisc',
  'stdev',
  'stdevp',
  'sum',
  'var',
  'varp',
];

export const isLACFunction = (funcName: string): boolean => {
  return lacFunctions.includes(funcName.toLowerCase());
};

export const getStandardFunctionName = (funcKey: string): string | undefined => {
  const entry = functionCategories[funcKey];
  return entry ? entry.standardFunction : funcKey;
};

export const getFunctionCategoryKey = (standardFuncName: string): string | undefined => {
  const lowerCaseFuncName = standardFuncName.toLowerCase();
  const entry = Object.entries(functionCategories).find(
    ([_key, value]) => value.standardFunction.toLowerCase() === lowerCaseFuncName
  );
  return entry ? entry[0] : undefined;
};

const BASE_URL = "https://docs.aws.amazon.com/quicksight/latest/user/";

// Generate documentation link for a function using standardFunction
export const getDocLink = (standardFunctionName: string): string | undefined => {
  // Ensure the standardFunctionName is correctly cased for the URL
  return `${BASE_URL}${standardFunctionName}-function.html`;
};