"""
AutoGen integration for conversational multi-agent systems
Optional: Use for more interactive agent conversations
"""
try:
    import autogen
    AUTOGEN_AVAILABLE = True
except ImportError:
    AUTOGEN_AVAILABLE = False
    print("AutoGen not available. Install with: pip install pyautogen")

from typing import List, Dict, Optional
import os

class AutoGenOrchestrator:
    """Alternative orchestration using Microsoft AutoGen"""
    
    def __init__(self):
        if not AUTOGEN_AVAILABLE:
            raise ImportError("AutoGen not installed")
        
        self.config_list = [{
            "model": os.getenv("MODEL_NAME", "gpt-4-turbo-preview"),
            "api_key": os.getenv("OPENAI_API_KEY")
        }]
        
        self.agents = self._create_agents()
    
    def _create_agents(self) -> Dict:
        """Create AutoGen agents"""
        
        # User proxy (executes code)
        user_proxy = autogen.UserProxyAgent(
            name="UserProxy",
            system_message="Execute code and provide feedback",
            code_execution_config={
                "work_dir": "workspace",
                "use_docker": False
            },
            human_input_mode="NEVER"
        )
        
        # Planner agent
        planner = autogen.AssistantAgent(
            name="Planner",
            system_message="""You are a planning expert. Break down complex tasks 
            into clear, executable steps. Coordinate with other agents.""",
            llm_config={"config_list": self.config_list}
        )
        
        # Data analyst agent
        analyst = autogen.AssistantAgent(
            name="DataAnalyst",
            system_message="""You are a data analyst. Analyze datasets, 
            compute statistics, and generate insights.""",
            llm_config={"config_list": self.config_list}
        )
        
        # Code engineer agent
        engineer = autogen.AssistantAgent(
            name="Engineer",
            system_message="""You are a software engineer. Write clean, 
            efficient Python code to solve problems.""",
            llm_config={"config_list": self.config_list}
        )
        
        return {
            'user_proxy': user_proxy,
            'planner': planner,
            'analyst': analyst,
            'engineer': engineer
        }
    
    def run_group_chat(self, query: str, max_rounds: int = 10) -> str:
        """Run a group chat between agents"""
        
        groupchat = autogen.GroupChat(
            agents=[
                self.agents['user_proxy'],
                self.agents['planner'],
                self.agents['analyst'],
                self.agents['engineer']
            ],
            messages=[],
            max_round=max_rounds
        )
        
        manager = autogen.GroupChatManager(
            groupchat=groupchat,
            llm_config={"config_list": self.config_list}
        )
        
        # Start conversation
        self.agents['user_proxy'].initiate_chat(
            manager,
            message=query
        )
        
        return groupchat.messages[-1]['content']
