// Validation schemas and rules

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  customValidator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface CsvValidationSchema {
  fileName: string;
  requiredColumns: ColumnValidation[];
  optionalColumns: ColumnValidation[];
  rowValidation: RowValidation[];
  constraints: DataConstraint[];
}

export interface ColumnValidation {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  pattern?: RegExp;
  minValue?: number;
  maxValue?: number;
  enumValues?: string[];
}

export interface RowValidation {
  name: string;
  description: string;
  validator: (row: Record<string, any>) => ValidationResult;
}

export interface DataConstraint {
  name: string;
  description: string;
  type: 'referential_integrity' | 'business_rule' | 'data_quality';
  validator: (data: any[]) => ValidationResult;
}