from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List
import os

class Step(BaseModel):
    step_number: int
    description: str
    tool_needed: str

class Plan(BaseModel):
    steps: List[Step]
    reasoning: str

class PlannerAgent:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=os.getenv("MODEL_NAME", "gpt-4-turbo-preview"),
            temperature=0.3
        )
        
        with open("prompts/planner_prompt.md", "r") as f:
            self.prompt_template = f.read()
    
    def plan(self, query: str, context: dict = None) -> Plan:
        prompt = ChatPromptTemplate.from_template(self.prompt_template)
        
        messages = prompt.format_messages(
            query=query,
            context=context or {},
            available_tools="web_search, dataset_analyzer, python_executor, rag_retriever"
        )
        
        response = self.llm.invoke(messages)
        
        # Parse response into structured plan
        return self._parse_plan(response.content)
    
    def _parse_plan(self, content: str) -> Plan:
        # Simple parsing - enhance based on needs
        steps = []
        lines = content.strip().split("\n")
        
        for i, line in enumerate(lines):
            if line.strip().startswith(("Step", str(i+1))):
                steps.append(Step(
                    step_number=i+1,
                    description=line,
                    tool_needed="auto"
                ))
        
        return Plan(steps=steps, reasoning="Generated plan")
