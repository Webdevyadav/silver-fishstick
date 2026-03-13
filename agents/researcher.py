from langchain.tools import DuckDuckGoSearchRun
from typing import Dict, List
import os

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False

class ResearchAgent:
    def __init__(self):
        self.ddg_search = DuckDuckGoSearchRun()
        
        if TAVILY_AVAILABLE and os.getenv("TAVILY_API_KEY"):
            self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        else:
            self.tavily = None
    
    def search_web(self, query: str, max_results: int = 5) -> List[Dict]:
        results = []
        
        # DuckDuckGo search
        try:
            ddg_result = self.ddg_search.run(query)
            results.append({
                "source": "duckduckgo",
                "content": ddg_result
            })
        except Exception as e:
            print(f"DuckDuckGo search failed: {e}")
        
        # Tavily search (if available)
        if self.tavily:
            try:
                tavily_results = self.tavily.search(query, max_results=max_results)
                results.append({
                    "source": "tavily",
                    "content": tavily_results
                })
            except Exception as e:
                print(f"Tavily search failed: {e}")
        
        return results
    
    def research(self, topic: str) -> Dict:
        search_results = self.search_web(topic)
        
        return {
            "topic": topic,
            "results": search_results,
            "summary": self._summarize_results(search_results)
        }
    
    def _summarize_results(self, results: List[Dict]) -> str:
        # Combine all results
        combined = "\n\n".join([
            f"Source: {r['source']}\n{r['content']}" 
            for r in results
        ])
        return combined[:2000]  # Truncate for context window
