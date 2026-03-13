"""
Advanced visualization tools
"""
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional

class VisualizationTools:
    """Create visualizations from data"""
    
    def __init__(self, output_dir: str = "outputs/plots"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Set style
        sns.set_theme(style="whitegrid")
        plt.rcParams['figure.figsize'] = (12, 6)
    
    def plot_distribution(self, data: pd.Series, title: str = "Distribution") -> str:
        """Plot data distribution"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Histogram
        ax1.hist(data.dropna(), bins=30, edgecolor='black', alpha=0.7)
        ax1.set_title(f"{title} - Histogram")
        ax1.set_xlabel("Value")
        ax1.set_ylabel("Frequency")
        
        # Box plot
        ax2.boxplot(data.dropna())
        ax2.set_title(f"{title} - Box Plot")
        ax2.set_ylabel("Value")
        
        filepath = self.output_dir / f"distribution_{title.replace(' ', '_')}.png"
        plt.tight_layout()
        plt.savefig(filepath, dpi=300, bbox_inches='tight')
        plt.close()
        
        return str(filepath)
    
    def plot_correlation_matrix(self, df: pd.DataFrame, title: str = "Correlation Matrix") -> str:
        """Plot correlation heatmap"""
        numeric_df = df.select_dtypes(include=['number'])
        corr = numeric_df.corr()
        
        plt.figure(figsize=(12, 10))
        sns.heatmap(corr, annot=True, fmt='.2f', cmap='coolwarm', 
                    center=0, square=True, linewidths=1)
        plt.title(title)
        
        filepath = self.output_dir / "correlation_matrix.png"
        plt.savefig(filepath, dpi=300, bbox_inches='tight')
        plt.close()
        
        return str(filepath)
    
    def plot_time_series(self, df: pd.DataFrame, date_col: str, 
                        value_cols: List[str], title: str = "Time Series") -> str:
        """Plot time series data"""
        fig = go.Figure()
        
        for col in value_cols:
            fig.add_trace(go.Scatter(
                x=df[date_col],
                y=df[col],
                mode='lines+markers',
                name=col
            ))
        
        fig.update_layout(
            title=title,
            xaxis_title="Date",
            yaxis_title="Value",
            hovermode='x unified'
        )
        
        filepath = self.output_dir / "time_series.html"
        fig.write_html(str(filepath))
        
        return str(filepath)
    
    def plot_categorical(self, data: pd.Series, title: str = "Category Distribution") -> str:
        """Plot categorical data"""
        value_counts = data.value_counts()
        
        fig = go.Figure(data=[
            go.Bar(x=value_counts.index, y=value_counts.values)
        ])
        
        fig.update_layout(
            title=title,
            xaxis_title="Category",
            yaxis_title="Count"
        )
        
        filepath = self.output_dir / f"categorical_{title.replace(' ', '_')}.html"
        fig.write_html(str(filepath))
        
        return str(filepath)
    
    def create_dashboard(self, df: pd.DataFrame) -> str:
        """Create interactive dashboard"""
        from plotly.subplots import make_subplots
        
        numeric_cols = df.select_dtypes(include=['number']).columns[:4]
        
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=[f"Distribution: {col}" for col in numeric_cols]
        )
        
        for idx, col in enumerate(numeric_cols):
            row = idx // 2 + 1
            col_pos = idx % 2 + 1
            
            fig.add_trace(
                go.Histogram(x=df[col], name=col),
                row=row, col=col_pos
            )
        
        fig.update_layout(height=800, showlegend=False, title_text="Data Dashboard")
        
        filepath = self.output_dir / "dashboard.html"
        fig.write_html(str(filepath))
        
        return str(filepath)
