"""
CrewAI integration for advanced multi-agent collaboration
Optional: Use when you need more sophisticated agent coordination
"""
try:
    from crewai import Agent, Task, Crew, Process
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    print("CrewAI not available. Install with: pip install crewai")

from typing import List, Dict
import os

class CrewAIOrchestrator:
    """Alternative orchestration using CrewAI"""
    
    def __init__(self):
        if not CREWAI_AVAILABLE:
            raise ImportError("CrewAI not installed")
        
        self.agents = self._create_agents()
    
    def _create_agents(self) -> Dict[str, Agent]:
        """Create specialized CrewAI agents"""
        
        researcher = Agent(
            role='Research Specialist',
            goal='Find and synthesize relevant information',
            backstory='Expert at finding and analyzing information from multiple sources',
            verbose=True,
            allow_delegation=False
        )
        
        analyst = Agent(
            role='Data Analyst',
            goal='Analyze datasets and extract insights',
            backstory='Experienced data scientist with expertise in statistical analysis',
            verbose=True,
            allow_delegation=False
        )
        
        engineer = Agent(
            role='Software Engineer',
            goal='Write and execute code solutions',
            backstory='Senior engineer skilled in Python and data processing',
            verbose=True,
            allow_delegation=False
        )
        
        reviewer = Agent(
            role='Quality Reviewer',
            goal='Ensure accuracy and completeness of outputs',
            backstory='Meticulous reviewer focused on quality assurance',
            verbose=True,
            allow_delegation=True
        )
        
        return {
            'researcher': researcher,
            'analyst': analyst,
            'engineer': engineer,
            'reviewer': reviewer
        }
    
    def create_crew(self, tasks: List[Task]) -> Crew:
        """Create a crew with tasks"""
        return Crew(
            agents=list(self.agents.values()),
            tasks=tasks,
            process=Process.sequential,
            verbose=True
        )
    
    def run_analysis_workflow(self, query: str, dataset_path: str = None) -> str:
        """Run complete analysis workflow"""
        
        # Define tasks
        research_task = Task(
            description=f"Research background information about: {query}",
            agent=self.agents['researcher']
        )
        
        analysis_task = Task(
            description=f"Analyze the dataset and answer: {query}",
            agent=self.agents['analyst']
        )
        
        code_task = Task(
            description="Generate Python code to support the analysis",
            agent=self.agents['engineer']
        )
        
        review_task = Task(
            description="Review all outputs for accuracy and completeness",
            agent=self.agents['reviewer']
        )
        
        # Create and run crew
        crew = self.create_crew([
            research_task,
            analysis_task,
            code_task,
            review_task
        ])
        
        result = crew.kickoff()
        return result
