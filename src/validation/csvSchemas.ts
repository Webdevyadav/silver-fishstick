import { CsvValidationSchema, ColumnValidation, RowValidation, DataConstraint, ValidationResult } from '@/types/validation';

export const rosterProcessingSchema: CsvValidationSchema = {
  fileName: 'roster_processing_details.csv',
  requiredColumns: [
    {
      name: 'file_id',
      type: 'string',
      nullable: false,
      pattern: /^[A-Z0-9_-]+$/
    },
    {
      name: 'submission_date',
      type: 'date',
      nullable: false
    },
    {
      name: 'market_segment',
      type: 'string',
      nullable: false,
      enumValues: ['commercial', 'medicare', 'medicaid', 'individual']
    },
    {
      name: 'provider_type',
      type: 'string',
      nullable: false,
      enumValues: ['primary_care', 'specialist', 'hospital', 'ancillary']
    },
    {
      name: 'total_records',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'processed_records',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'failed_records',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'rejected_records',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'processing_stage',
      type: 'string',
      nullable: false,
      enumValues: ['intake', 'validation', 'transformation', 'loading', 'complete']
    },
    {
      name: 'processing_time_minutes',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'retry_count',
      type: 'number',
      nullable: false,
      minValue: 0,
      maxValue: 10
    },
    {
      name: 'final_status',
      type: 'string',
      nullable: false,
      enumValues: ['success', 'failed', 'partial']
    }
  ],
  optionalColumns: [
    {
      name: 'error_codes',
      type: 'string',
      nullable: true
    }
  ],
  rowValidation: [
    {
      name: 'record_count_consistency',
      description: 'Processed + failed + rejected should not exceed total records',
      validator: (row) => {
        const total = parseInt(row.total_records);
        const processed = parseInt(row.processed_records);
        const failed = parseInt(row.failed_records);
        const rejected = parseInt(row.rejected_records);
        
        const isValid = (processed + failed + rejected) <= total;
        
        return {
          isValid,
          errors: isValid ? [] : [{
            field: 'record_counts',
            message: 'Sum of processed, failed, and rejected records exceeds total records',
            code: 'RECORD_COUNT_MISMATCH',
            value: { total, processed, failed, rejected }
          }],
          warnings: []
        };
      }
    }
  ],
  constraints: [
    {
      name: 'unique_file_ids',
      description: 'File IDs should be unique across the dataset',
      type: 'data_quality',
      validator: (data) => {
        const fileIds = data.map(row => row.file_id);
        const uniqueFileIds = new Set(fileIds);
        const isValid = fileIds.length === uniqueFileIds.size;
        
        return {
          isValid,
          errors: isValid ? [] : [{
            field: 'file_id',
            message: 'Duplicate file IDs found in dataset',
            code: 'DUPLICATE_FILE_IDS',
            value: fileIds.length - uniqueFileIds.size
          }],
          warnings: []
        };
      }
    }
  ]
};
export const operationalMetricsSchema: CsvValidationSchema = {
  fileName: 'aggregated_operational_metrics.csv',
  requiredColumns: [
    {
      name: 'market_id',
      type: 'string',
      nullable: false,
      pattern: /^[A-Z]{2,3}_[A-Z0-9]+$/
    },
    {
      name: 'month',
      type: 'string',
      nullable: false,
      pattern: /^\d{4}-\d{2}$/
    },
    {
      name: 'total_files_received',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'files_processed_successfully',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'average_processing_time',
      type: 'number',
      nullable: false,
      minValue: 0
    },
    {
      name: 'error_rate_percentage',
      type: 'number',
      nullable: false,
      minValue: 0,
      maxValue: 100
    },
    {
      name: 'provider_onboarding_rate',
      type: 'number',
      nullable: false,
      minValue: 0,
      maxValue: 100
    },
    {
      name: 'data_quality_score',
      type: 'number',
      nullable: false,
      minValue: 0,
      maxValue: 100
    },
    {
      name: 'sla_compliance_percentage',
      type: 'number',
      nullable: false,
      minValue: 0,
      maxValue: 100
    }
  ],
  optionalColumns: [
    {
      name: 'top_error_categories',
      type: 'string',
      nullable: true
    }
  ],
  rowValidation: [
    {
      name: 'success_rate_consistency',
      description: 'Files processed successfully should not exceed total files received',
      validator: (row) => {
        const total = parseInt(row.total_files_received);
        const successful = parseInt(row.files_processed_successfully);
        
        const isValid = successful <= total;
        
        return {
          isValid,
          errors: isValid ? [] : [{
            field: 'files_processed_successfully',
            message: 'Files processed successfully exceeds total files received',
            code: 'SUCCESS_COUNT_EXCEEDS_TOTAL',
            value: { total, successful }
          }],
          warnings: []
        };
      }
    }
  ],
  constraints: [
    {
      name: 'unique_market_month',
      description: 'Market ID and month combinations should be unique',
      type: 'referential_integrity',
      validator: (data) => {
        const combinations = data.map(row => `${row.market_id}_${row.month}`);
        const uniqueCombinations = new Set(combinations);
        const isValid = combinations.length === uniqueCombinations.size;
        
        return {
          isValid,
          errors: isValid ? [] : [{
            field: 'market_id_month',
            message: 'Duplicate market ID and month combinations found',
            code: 'DUPLICATE_MARKET_MONTH',
            value: combinations.length - uniqueCombinations.size
          }],
          warnings: []
        };
      }
    }
  ]
};