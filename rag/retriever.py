from llama_index import VectorStoreIndex, ServiceContext
from llama_index.embeddings import HuggingFaceEmbedding
from llama_index.vector_stores import ChromaVectorStore
import chromadb
from typing import List, Dict

class RAGAgent:
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.embed_model = HuggingFaceEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        self.chroma_client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.chroma_client.get_or_create_collection("documents")
        
        self.vector_store = ChromaVectorStore(chroma_collection=self.collection)
        
        service_context = ServiceContext.from_defaults(embed_model=self.embed_model)
        self.index = VectorStoreIndex.from_vector_store(
            self.vector_store,
            service_context=service_context
        )
        
        self.query_engine = self.index.as_query_engine(similarity_top_k=5)
    
    def retrieve(self, query: str, top_k: int = 5) -> List[Dict]:
        response = self.query_engine.query(query)
        
        results = []
        for node in response.source_nodes:
            results.append({
                "text": node.node.text,
                "score": node.score,
                "metadata": node.node.metadata
            })
        
        return results
    
    def query(self, question: str) -> str:
        response = self.query_engine.query(question)
        return str(response)
