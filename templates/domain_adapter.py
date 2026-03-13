"""
Domain Adapter - Rapidly customize system for any problem domain
Usage: When problem statement arrives, fill in domain-specific logic
"""
from typing import Dict, List, Any
from dataclasses import dataclass
import pandas as pd

@dataclass
class DomainConfig:
    """Configure system for specific domain"""
    domain_name: str
    problem_type: str  # "classification", "regression", "optimization", "analysis"
    key_metrics: List[str]
    data_columns: List[str] = None
    business_rules: Dict[str, Any] = None

class DomainAdapter:
    """Adapt the agent system to any domain in minutes"""
    
    def __init__(self, config: DomainConfig):
        self.config = config
        self.tools = self._generate_domain_tools()
        self.prompts = self._generate_domain_prompts()
    
    def _generate_domain_tools(self) -> Dict:
        """Auto-generate domain-specific tools"""
        tools = {}
        
        # Classification domain
        if self.config.problem_type == "classification":
            tools.update({
                "train_classifier": self._create_classifier_tool,
                "evaluate_model": self._create_evaluation_tool,
                "predict": self._create_prediction_tool
            })
        
        # Regression domain
        elif self.config.problem_type == "regression":
            tools.update({
                "train_regressor": self._create_regressor_tool,
                "forecast": self._create_forecast_tool,
                "analyze_trends": self._create_trend_tool
            })
        
        # Optimization domain
        elif self.config.problem_type == "optimization":
            tools.update({
                "optimize": self._create_optimizer_tool,
                "constraint_check": self._create_constraint_tool,
                "simulate": self._create_simulation_tool
            })
        
        # Analysis domain (default)
        else:
            tools.update({
                "analyze_data": self._create_analysis_tool,
                "find_patterns": self._create_pattern_tool,
                "generate_insights": self._create_insight_tool
            })
        
        return tools
    
    def _generate_domain_prompts(self) -> Dict[str, str]:
        """Generate domain-specific prompts"""
        return {
            "planner": f"""You are analyzing a {self.config.domain_name} problem.
Problem Type: {self.config.problem_type}
Key Metrics: {', '.join(self.config.key_metrics)}

Break down the task into steps using available domain tools.
Focus on: data validation, analysis, modeling, evaluation, insights.""",
            
            "evaluator": f"""Evaluate the solution for {self.config.domain_name}.
Check:
1. Are key metrics ({', '.join(self.config.key_metrics)}) addressed?
2. Is the analysis complete and accurate?
3. Are insights actionable?
4. Does it solve the core problem?"""
        }
    
    # Tool creators (to be filled based on domain)
    def _create_classifier_tool(self, data, target):
        """Template for classification"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report
        
        X = data.drop(columns=[target])
        y = data[target]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
        
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        predictions = model.predict(X_test)
        report = classification_report(y_test, predictions)
        
        return {
            "model": model,
            "accuracy": model.score(X_test, y_test),
            "report": report,
            "feature_importance": dict(zip(X.columns, model.feature_importances_))
        }
    
    def _create_regressor_tool(self, data, target):
        """Template for regression"""
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_squared_error, r2_score
        
        X = data.drop(columns=[target])
        y = data[target]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
        
        model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        predictions = model.predict(X_test)
        
        return {
            "model": model,
            "mse": mean_squared_error(y_test, predictions),
            "r2": r2_score(y_test, predictions),
            "predictions": predictions
        }
    
    def _create_optimizer_tool(self, objective_func, constraints):
        """Template for optimization"""
        from scipy.optimize import minimize
        
        result = minimize(
            objective_func,
            x0=[0] * len(constraints),
            constraints=constraints,
            method='SLSQP'
        )
        
        return {
            "optimal_solution": result.x,
            "optimal_value": result.fun,
            "success": result.success,
            "message": result.message
        }
    
    def _create_analysis_tool(self, data):
        """Template for general analysis"""
        return {
            "summary": data.describe().to_dict(),
            "correlations": data.corr().to_dict(),
            "missing": data.isnull().sum().to_dict(),
            "dtypes": data.dtypes.astype(str).to_dict()
        }
    
    def _create_pattern_tool(self, data):
        """Template for pattern detection"""
        patterns = []
        
        # Detect outliers
        numeric_cols = data.select_dtypes(include=['number']).columns
        for col in numeric_cols:
            q1 = data[col].quantile(0.25)
            q3 = data[col].quantile(0.75)
            iqr = q3 - q1
            outliers = data[(data[col] < q1 - 1.5*iqr) | (data[col] > q3 + 1.5*iqr)]
            if len(outliers) > 0:
                patterns.append({
                    "type": "outliers",
                    "column": col,
                    "count": len(outliers)
                })
        
        return patterns
    
    def _create_insight_tool(self, analysis_results):
        """Template for insight generation"""
        insights = []
        
        # Generate insights from analysis
        for key, value in analysis_results.items():
            if isinstance(value, dict):
                insights.append(f"Key finding in {key}: {value}")
        
        return insights
    
    def export_config(self) -> str:
        """Export configuration for quick setup"""
        return f"""
# Domain Configuration
DOMAIN_NAME = "{self.config.domain_name}"
PROBLEM_TYPE = "{self.config.problem_type}"
KEY_METRICS = {self.config.key_metrics}

# Quick Setup
from templates.domain_adapter import DomainAdapter, DomainConfig

config = DomainConfig(
    domain_name=DOMAIN_NAME,
    problem_type=PROBLEM_TYPE,
    key_metrics=KEY_METRICS
)

adapter = DomainAdapter(config)
"""

# Example usage for different domains
DOMAIN_TEMPLATES = {
    "healthcare": DomainConfig(
        domain_name="Healthcare Analytics",
        problem_type="classification",
        key_metrics=["accuracy", "precision", "recall", "f1_score"]
    ),
    "finance": DomainConfig(
        domain_name="Financial Forecasting",
        problem_type="regression",
        key_metrics=["mse", "mae", "r2_score"]
    ),
    "logistics": DomainConfig(
        domain_name="Route Optimization",
        problem_type="optimization",
        key_metrics=["total_cost", "delivery_time", "efficiency"]
    ),
    "retail": DomainConfig(
        domain_name="Customer Analytics",
        problem_type="analysis",
        key_metrics=["customer_lifetime_value", "churn_rate", "conversion_rate"]
    )
}
