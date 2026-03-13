"""
Tests for tool modules
"""
import pytest
import pandas as pd
import numpy as np
import sys
sys.path.append("..")

from tools.dataset_tools import DatasetTools
from tools.python_exec import PythonExecutor

class TestDatasetTools:
    """Test dataset analysis tools"""
    
    def test_get_summary(self):
        """Test dataset summary generation"""
        df = pd.DataFrame({
            'A': [1, 2, 3, 4, 5],
            'B': [10, 20, 30, 40, 50],
            'C': ['a', 'b', 'c', 'd', 'e']
        })
        
        summary = DatasetTools.get_summary(df)
        
        assert summary is not None
        assert summary['shape'] == (5, 3)
        assert len(summary['columns']) == 3
        assert 'A' in summary['columns']
    
    def test_analyze_column(self):
        """Test column analysis"""
        df = pd.DataFrame({
            'numbers': [1, 2, 3, 4, 5, np.nan]
        })
        
        analysis = DatasetTools.analyze_column(df, 'numbers')
        
        assert analysis is not None
        assert 'mean' in analysis
        assert 'missing_count' in analysis
        assert analysis['missing_count'] == 1
    
    def test_find_correlations(self):
        """Test correlation finding"""
        df = pd.DataFrame({
            'A': [1, 2, 3, 4, 5],
            'B': [2, 4, 6, 8, 10],  # Perfect correlation with A
            'C': [5, 4, 3, 2, 1]    # Negative correlation
        })
        
        correlations = DatasetTools.find_correlations(df, threshold=0.9)
        
        assert len(correlations) > 0
        assert any(c['correlation'] > 0.9 for c in correlations)

class TestPythonExecutor:
    """Test Python code execution"""
    
    def test_simple_execution(self):
        """Test simple code execution"""
        executor = PythonExecutor()
        result = executor.execute("x = 5\nprint(x)")
        
        assert result['success'] is True
        assert '5' in result['output']
    
    def test_pandas_execution(self):
        """Test pandas code execution"""
        executor = PythonExecutor()
        code = """
import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3]})
print(df.shape)
"""
        result = executor.execute(code)
        
        assert result['success'] is True
        assert '3' in result['output']
    
    def test_error_handling(self):
        """Test error handling in execution"""
        executor = PythonExecutor()
        result = executor.execute("1 / 0")
        
        assert result['success'] is False
        assert result['error'] is not None
        assert 'division' in result['error'].lower()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
