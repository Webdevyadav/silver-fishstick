"""
Unit tests for agent system
"""
import pytest
import sys
sys.path.append("..")

from agents.planner import PlannerAgent
from agents.researcher import ResearchAgent
from agents.executor import ToolAgent
from agents.evaluator import EvaluatorAgent

class TestPlannerAgent:
    """Test planner agent"""
    
    def test_planner_initialization(self):
        """Test planner can be initialized"""
        planner = PlannerAgent()
        assert planner is not None
        assert planner.llm is not None
    
    def test_plan_generation(self):
        """Test plan generation"""
        planner = PlannerAgent()
        plan = planner.plan("Analyze a dataset")
        
        assert plan is not None
        assert hasattr(plan, 'steps')
        assert len(plan.steps) > 0

class TestResearchAgent:
    """Test research agent"""
    
    def test_researcher_initialization(self):
        """Test researcher can be initialized"""
        researcher = ResearchAgent()
        assert researcher is not None
    
    def test_web_search(self):
        """Test web search functionality"""
        researcher = ResearchAgent()
        results = researcher.search_web("Python programming", max_results=2)
        
        assert results is not None
        assert len(results) > 0

class TestToolAgent:
    """Test tool execution agent"""
    
    def test_tool_agent_initialization(self):
        """Test tool agent can be initialized"""
        executor = ToolAgent()
        assert executor is not None
        assert len(executor.tools) > 0
    
    def test_python_execution(self):
        """Test Python code execution"""
        executor = ToolAgent()
        result = executor.execute("python_executor", code="print('Hello')")
        
        assert result["success"] is True
        assert "Hello" in result["result"]
    
    def test_statistics_tool(self):
        """Test statistics computation"""
        executor = ToolAgent()
        result = executor.execute("statistics_tool", data=[1, 2, 3, 4, 5])
        
        assert result["success"] is True
        assert "mean" in result["result"]
        assert result["result"]["mean"] == 3.0

class TestEvaluatorAgent:
    """Test evaluator agent"""
    
    def test_evaluator_initialization(self):
        """Test evaluator can be initialized"""
        evaluator = EvaluatorAgent()
        assert evaluator is not None
    
    def test_evaluation(self):
        """Test response evaluation"""
        evaluator = EvaluatorAgent()
        evaluation = evaluator.evaluate(
            query="What is 2+2?",
            response="The answer is 4"
        )
        
        assert evaluation is not None
        assert hasattr(evaluation, 'is_satisfactory')
        assert hasattr(evaluation, 'confidence')
    
    def test_retry_logic(self):
        """Test retry decision logic"""
        evaluator = EvaluatorAgent()
        
        # Should not retry if satisfactory
        eval_good = type('obj', (object,), {'is_satisfactory': True})()
        assert evaluator.should_retry(eval_good, 1) is False
        
        # Should retry if unsatisfactory and under max iterations
        eval_bad = type('obj', (object,), {'is_satisfactory': False})()
        assert evaluator.should_retry(eval_bad, 1) is True
        
        # Should not retry if max iterations reached
        assert evaluator.should_retry(eval_bad, 5) is False

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
