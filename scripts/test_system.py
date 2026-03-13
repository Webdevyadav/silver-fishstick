import sys
sys.path.append("..")

from graph.agent_graph import AgentOrchestrator

def test_basic_query():
    print("Testing AI Agent System...")
    
    orchestrator = AgentOrchestrator()
    
    test_query = "Analyze the dataset and provide summary statistics"
    
    print(f"\nQuery: {test_query}")
    print("\nProcessing...\n")
    
    result = orchestrator.run(test_query)
    
    print("=" * 50)
    print("RESULT:")
    print("=" * 50)
    print(f"Response: {result.get('response', 'No response')}")
    print(f"\nIterations: {result.get('iteration', 0)}")
    print(f"\nEvaluation: {result.get('evaluation', {})}")

if __name__ == "__main__":
    test_basic_query()
