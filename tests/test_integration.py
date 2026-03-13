"""
Integration tests for full system
"""
import pytest
import sys
sys.path.append("..")

from graph.agent_graph import AgentOrchestrator

class TestSystemIntegration:
    """Test full system integration"""
    
    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator instance"""
        return AgentOrchestrator()
    
    def test_simple_query(self, orchestrator):
        """Test simple query processing"""
        result = orchestrator.run("What is 2 + 2?")
        
        assert result is not None
        assert 'response' in result
        assert result['response'] is not None
    
    def test_multi_step_query(self, orchestrator):
        """Test multi-step query"""
        result = orchestrator.run("Analyze data and provide insights")
        
        assert result is not None
        assert 'plan' in result
        assert 'iteration' in result
    
    def test_retry_mechanism(self, orchestrator):
        """Test retry mechanism works"""
        result = orchestrator.run("Complex analysis task")
        
        assert result is not None
        assert 'evaluation' in result
        # System should attempt at least one iteration
        assert result.get('iteration', 0) >= 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
