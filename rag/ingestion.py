from llama_index import VectorStoreIndex, SimpleDirectoryReader, ServiceContext
from llama_index.embeddings import HuggingFaceEmbedding
from llama_index.vector_stores import ChromaVectorStore
from llama_index.storage.storage_context import StorageContext
import chromadb
from pathlib import Path

class RAGIngestion:
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.persist_dir = persist_dir
        
        # Initialize embedding model
        self.embed_model = HuggingFaceEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.chroma_client.get_or_create_collection("documents")
        
        # Create vector store
        self.vector_store = ChromaVectorStore(chroma_collection=self.collection)
        self.storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
    
    def ingest_directory(self, directory: str):
        documents = SimpleDirectoryReader(directory).load_data()
        
        service_context = ServiceContext.from_defaults(embed_model=self.embed_model)
        
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=self.storage_context,
            service_context=service_context
        )
        
        return index
    
    def ingest_files(self, file_paths: list[str]):
        documents = []
        for path in file_paths:
            docs = SimpleDirectoryReader(input_files=[path]).load_data()
            documents.extend(docs)
        
        service_context = ServiceContext.from_defaults(embed_model=self.embed_model)
        
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=self.storage_context,
            service_context=service_context
        )
        
        return index
