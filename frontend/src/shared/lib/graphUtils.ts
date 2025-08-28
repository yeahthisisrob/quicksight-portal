/**
 * Extracts tokens from an expression, excluding string literals.
 * @param expression The expression string.
 * @returns An array of tokens (words) outside of string literals.
 */
const extractTokens = (expression: string): string[] => {
  if (!expression || typeof expression !== 'string') {
    return [];
  }
  
  const tokens: string[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let token = "";

  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];

    // Toggle quote states
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    // If inside quotes, skip characters
    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    // Build tokens based on word boundaries
    if (/[\w-]/.test(char)) {
      token += char;
    } else {
      if (token.length > 0) {
        tokens.push(token);
        token = "";
      }
    }
  }

  // Push the last token if exists
  if (token.length > 0) {
    tokens.push(token);
  }

  return tokens;
};

export interface CalculatedFieldForGraph {
  fieldName: string;
  expression: string;
  dataSetIdentifier?: string;
}

export const getDependencyChain = (
  field: CalculatedFieldForGraph,
  allFields: CalculatedFieldForGraph[],
) => {
  const chain: Array<{
    alias: string;
    expression: string;
    type: string;
    level: number;
  }> = [];

  const visited = new Set<string>();

  // Start with the selected field
  chain.push({
    alias: field.fieldName,
    expression: field.expression,
    type: "calculatedField",
    level: 0,
  });
  visited.add(field.fieldName);

  // Precompute a map for quick lookup
  const fieldMap = new Map<string, CalculatedFieldForGraph>();
  allFields.forEach((f) => fieldMap.set(f.fieldName, f));

  /**
   * Recursively find dependencies.
   * @param currentField The current calculated field being processed.
   * @param level The current recursion depth level.
   */
  const findDependencies = (currentField: CalculatedFieldForGraph, level: number) => {
    if (level > 20) {
      // Prevent potential infinite recursion
      return;
    }

    // Extract tokens excluding string literals
    const tokens = extractTokens(currentField.expression);

    tokens.forEach((token) => {
      // Check if the token corresponds to a calculated field
      if (fieldMap.has(token) && !visited.has(token)) {
        const dependentField = fieldMap.get(token)!;
        chain.push({
          alias: dependentField.fieldName,
          expression: dependentField.expression,
          type: "calculatedField",
          level: level + 1,
        });
        visited.add(dependentField.fieldName);
        findDependencies(dependentField, level + 1);
      }
    });
  };

  findDependencies(field, 0);

  return chain;
};