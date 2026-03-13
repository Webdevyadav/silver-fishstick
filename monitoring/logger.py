"""
Advanced logging and monitoring system
"""
import logging
from logging.handlers import RotatingFileHandler
from rich.console import Console
from rich.logging import RichHandler
from datetime import datetime
import json
from pathlib import Path
from typing import Dict, Any

class AgentLogger:
    """Structured logging for agent system"""
    
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        self.console = Console()
        self._setup_loggers()
    
    def _setup_loggers(self):
        """Setup multiple loggers"""
        
        # Main application logger
        self.app_logger = logging.getLogger("agent_system")
        self.app_logger.setLevel(logging.INFO)
        
        # File handler
        file_handler = RotatingFileHandler(
            self.log_dir / "agent_system.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        
        # Rich console handler
        console_handler = RichHandler(console=self.console, rich_tracebacks=True)
        
        self.app_logger.addHandler(file_handler)
        self.app_logger.addHandler(console_handler)
        
        # Agent activity logger
        self.activity_logger = logging.getLogger("agent_activity")
        self.activity_logger.setLevel(logging.DEBUG)
        
        activity_handler = RotatingFileHandler(
            self.log_dir / "agent_activity.log",
            maxBytes=10*1024*1024,
            backupCount=5
        )
        activity_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(message)s'
        ))
        self.activity_logger.addHandler(activity_handler)
    
    def log_query(self, query: str, metadata: Dict[str, Any] = None):
        """Log incoming query"""
        self.app_logger.info(f"New query: {query}")
        self._log_activity("query", {"query": query, **(metadata or {})})
    
    def log_agent_action(self, agent: str, action: str, details: Dict = None):
        """Log agent action"""
        self.app_logger.info(f"[{agent}] {action}")
        self._log_activity("agent_action", {
            "agent": agent,
            "action": action,
            "details": details or {}
        })
    
    def log_tool_execution(self, tool: str, params: Dict, result: Any):
        """Log tool execution"""
        self.app_logger.info(f"Tool executed: {tool}")
        self._log_activity("tool_execution", {
            "tool": tool,
            "params": params,
            "result": str(result)[:500]  # Truncate
        })
    
    def log_error(self, error: Exception, context: Dict = None):
        """Log error with context"""
        self.app_logger.error(f"Error: {str(error)}", exc_info=True)
        self._log_activity("error", {
            "error": str(error),
            "type": type(error).__name__,
            "context": context or {}
        })
    
    def log_evaluation(self, evaluation: Dict):
        """Log evaluation results"""
        self.app_logger.info(f"Evaluation: {evaluation.get('is_satisfactory', False)}")
        self._log_activity("evaluation", evaluation)
    
    def _log_activity(self, event_type: str, data: Dict):
        """Log structured activity"""
        activity = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "data": data
        }
        self.activity_logger.debug(json.dumps(activity))
    
    def print_status(self, message: str, style: str = "info"):
        """Print colored status message"""
        styles = {
            "info": "blue",
            "success": "green",
            "warning": "yellow",
            "error": "red"
        }
        self.console.print(f"[{styles.get(style, 'white')}]{message}[/]")

# Global logger instance
logger = AgentLogger()
