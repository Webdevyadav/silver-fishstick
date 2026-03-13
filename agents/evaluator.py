from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel
import os

class Evaluation(BaseModel):
    is_satisfactory: bool
    confidence: float
    issues: list[str]
    suggestions: list[str]

class EvaluatorAgent:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=os.getenv("MODEL_NAME", "gpt-4-turbo-preview"),
            temperature=0.2
        )
        
        with open("prompts/evaluator_prompt.md", "r") as f:
            self.prompt_template = f.read()
    
    def evaluate(self, query: str, response: str, context: dict = None) -> Evaluation:
        prompt = ChatPromptTemplate.from_template(self.prompt_template)
        
        messages = prompt.format_messages(
            query=query,
            response=response,
            context=context or {}
        )
        
        result = self.llm.invoke(messages)
        
        return self._parse_evaluation(result.content)
    
    def _parse_evaluation(self, content: str) -> Evaluation:
        # Simple parsing - enhance as needed
        is_satisfactory = "satisfactory" in content.lower() or "good" in content.lower()
        
        return Evaluation(
            is_satisfactory=is_satisfactory,
            confidence=0.8,
            issues=[],
            suggestions=[]
        )
    
    def should_retry(self, evaluation: Evaluation, iteration: int, max_iterations: int = 3) -> bool:
        if iteration >= max_iterations:
            return False
        
        return not evaluation.is_satisfactory
