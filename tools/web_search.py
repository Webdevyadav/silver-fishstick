from duckduckgo_search import DDGS
from typing import List, Dict

class WebSearchTool:
    """Web search capabilities"""
    
    def __init__(self):
        self.ddgs = DDGS()
    
    def search(self, query: str, max_results: int = 5) -> List[Dict]:
        """Search the web using DuckDuckGo"""
        try:
            results = list(self.ddgs.text(query, max_results=max_results))
            return results
        except Exception as e:
            return [{"error": str(e)}]
    
    def search_news(self, query: str, max_results: int = 5) -> List[Dict]:
        """Search news articles"""
        try:
            results = list(self.ddgs.news(query, max_results=max_results))
            return results
        except Exception as e:
            return [{"error": str(e)}]
