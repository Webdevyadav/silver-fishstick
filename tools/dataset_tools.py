import pandas as pd
import numpy as np
from typing import Dict, Any, List

class DatasetTools:
    """Tools for dataset analysis - customize when dataset arrives"""
    
    @staticmethod
    def load_dataset(filepath: str) -> pd.DataFrame:
        """Load dataset from file"""
        if filepath.endswith('.csv'):
            return pd.read_csv(filepath)
        elif filepath.endswith('.json'):
            return pd.read_json(filepath)
        elif filepath.endswith('.parquet'):
            return pd.read_parquet(filepath)
        else:
            raise ValueError(f"Unsupported file format: {filepath}")
    
    @staticmethod
    def get_summary(df: pd.DataFrame) -> Dict[str, Any]:
        """Get comprehensive dataset summary"""
        return {
            "shape": df.shape,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "memory_usage": df.memory_usage(deep=True).sum(),
            "numeric_summary": df.describe().to_dict()
        }
    
    @staticmethod
    def analyze_column(df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """Analyze specific column"""
        col_data = df[column]
        
        analysis = {
            "dtype": str(col_data.dtype),
            "unique_values": int(col_data.nunique()),
            "missing_count": int(col_data.isnull().sum()),
            "missing_percentage": float(col_data.isnull().mean() * 100)
        }
        
        if pd.api.types.is_numeric_dtype(col_data):
            analysis.update({
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "std": float(col_data.std()),
                "min": float(col_data.min()),
                "max": float(col_data.max())
            })
        
        return analysis
    
    @staticmethod
    def find_correlations(df: pd.DataFrame, threshold: float = 0.7) -> List[Dict]:
        """Find strong correlations in numeric columns"""
        numeric_df = df.select_dtypes(include=[np.number])
        corr_matrix = numeric_df.corr()
        
        correlations = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold:
                    correlations.append({
                        "col1": corr_matrix.columns[i],
                        "col2": corr_matrix.columns[j],
                        "correlation": float(corr_value)
                    })
        
        return correlations
