import sys
from io import StringIO
from typing import Dict, Any
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

class PythonExecutor:
    """Safe Python code execution"""
    
    def __init__(self):
        self.allowed_modules = {
            'pd': pd,
            'np': np,
            'plt': plt
        }
    
    def execute(self, code: str) -> Dict[str, Any]:
        """Execute Python code safely"""
        old_stdout = sys.stdout
        sys.stdout = captured = StringIO()
        
        result = {
            "success": False,
            "output": "",
            "error": None
        }
        
        try:
            exec(code, self.allowed_modules)
            result["output"] = captured.getvalue()
            result["success"] = True
        except Exception as e:
            result["error"] = str(e)
        finally:
            sys.stdout = old_stdout
        
        return result
