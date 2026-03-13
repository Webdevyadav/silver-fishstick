import sys
from io import StringIO
from typing import Dict, Any
import pandas as pd
import numpy as np

class ToolAgent:
    def __init__(self):
        self.tools = {
            "python_executor": self.execute_python,
            "dataset_analyzer": self.analyze_dataset,
            "csv_reader": self.read_csv,
            "statistics_tool": self.compute_statistics
        }
    
    def execute(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        if tool_name not in self.tools:
            return {"error": f"Tool {tool_name} not found"}
        
        try:
            result = self.tools[tool_name](**kwargs)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def execute_python(self, code: str) -> str:
        old_stdout = sys.stdout
        sys.stdout = captured_output = StringIO()
        
        try:
            exec(code, {"pd": pd, "np": np})
            output = captured_output.getvalue()
            return output
        except Exception as e:
            return f"Error: {str(e)}"
        finally:
            sys.stdout = old_stdout
    
    def analyze_dataset(self, filepath: str) -> Dict:
        df = pd.read_csv(filepath)
        
        return {
            "shape": df.shape,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.to_dict(),
            "missing": df.isnull().sum().to_dict(),
            "summary": df.describe().to_dict()
        }
    
    def read_csv(self, filepath: str, nrows: int = None) -> Dict:
        df = pd.read_csv(filepath, nrows=nrows)
        return {
            "data": df.to_dict(orient="records"),
            "shape": df.shape
        }
    
    def compute_statistics(self, data: list, column: str = None) -> Dict:
        arr = np.array(data)
        
        return {
            "mean": float(np.mean(arr)),
            "median": float(np.median(arr)),
            "std": float(np.std(arr)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr))
        }
