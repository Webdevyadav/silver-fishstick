from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Sequence
import operator
from agents.planner import PlannerAgent
from agents.researcher import ResearchAgent
from agents.executor import ToolAgent
from agents.evaluator import EvaluatorAgent
from rag.retriever import RAGAgent

class AgentState(TypedDict):
    query: str
    plan: dict
    research_results: list
    tool_results: list
    rag_context: str
    response: str
    evaluation: dict
    iteration: int
    messages: Annotated[Sequence[str], operator.add]

class AgentOrchestrator:
    def __init__(self):
        self.planner = PlannerAgent()
        self.researcher = ResearchAgent()
        self.executor = ToolAgent()
        self.evaluator = EvaluatorAgent()
        self.rag = RAGAgent()
        
        self.graph = self._build_graph()
    
    def _build_graph(self):
        workflow = StateGraph(AgentState)
        
        workflow.add_node("plan", self.plan_node)
        workflow.add_node("research", self.research_node)
        workflow.add_node("execute", self.execute_node)
        workflow.add_node("retrieve", self.retrieve_node)
        workflow.add_node("evaluate", self.evaluate_node)
        workflow.add_node("respond", self.respond_node)
        
        workflow.set_entry_point("plan")
        workflow.add_edge("plan", "research")
        workflow.add_edge("research", "retrieve")
        workflow.add_edge("retrieve", "execute")
        workflow.add_edge("execute", "respond")
        workflow.add_edge("respond", "evaluate")
        
        workflow.add_conditional_edges(
            "evaluate",
            self.should_continue,
            {
                "continue": "plan",
                "end": END
            }
        )
        
        return workflow.compile()
    
    def plan_node(self, state: AgentState):
        plan = self.planner.plan(state["query"])
        return {"plan": plan.dict(), "messages": ["Planning complete"]}
    
    def research_node(self, state: AgentState):
        results = self.researcher.research(state["query"])
        return {"research_results": [results], "messages": ["Research complete"]}
    
    def retrieve_node(self, state: AgentState):
        context = self.rag.query(state["query"])
        return {"rag_context": context, "messages": ["RAG retrieval complete"]}
    
    def execute_node(self, state: AgentState):
        results = []
        plan = state.get("plan", {})
        
        for step in plan.get("steps", []):
            tool_name = step.get("tool_needed", "python_executor")
            result = self.executor.execute(tool_name)
            results.append(result)
        
        return {"tool_results": results, "messages": ["Execution complete"]}
    
    def respond_node(self, state: AgentState):
        response = f"Query: {state['query']}\n"
        response += f"Context: {state.get('rag_context', '')}\n"
        response += f"Results: {state.get('tool_results', [])}"
        
        return {"response": response, "messages": ["Response generated"]}
    
    def evaluate_node(self, state: AgentState):
        evaluation = self.evaluator.evaluate(
            state["query"],
            state["response"]
        )
        
        iteration = state.get("iteration", 0) + 1
        
        return {
            "evaluation": evaluation.dict(),
            "iteration": iteration,
            "messages": ["Evaluation complete"]
        }
    
    def should_continue(self, state: AgentState):
        evaluation = state.get("evaluation", {})
        iteration = state.get("iteration", 0)
        
        if iteration >= 3 or evaluation.get("is_satisfactory", False):
            return "end"
        return "continue"
    
    def run(self, query: str):
        initial_state = {
            "query": query,
            "iteration": 0,
            "messages": []
        }
        
        result = self.graph.invoke(initial_state)
        return result
