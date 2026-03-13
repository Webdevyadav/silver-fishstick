#!/usr/bin/env python3
"""
CLI interface for AI Agent System
"""
import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
import sys
sys.path.append("..")

from graph.agent_graph import AgentOrchestrator
from rag.ingestion import RAGIngestion
from monitoring.metrics import metrics_collector
from monitoring.logger import logger

app = typer.Typer(help="AI Agent System CLI")
console = Console()

@app.command()
def query(
    text: str = typer.Argument(..., help="Query to process"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output")
):
    """Process a query through the agent system"""
    console.print(f"[blue]Processing query:[/blue] {text}")
    
    orchestrator = AgentOrchestrator()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Running agents...", total=None)
        
        try:
            result = orchestrator.run(text)
            progress.update(task, completed=True)
            
            console.print("\n[green]✓ Query completed[/green]\n")
            console.print("[bold]Response:[/bold]")
            console.print(result.get("response", "No response"))
            
            if verbose:
                console.print("\n[bold]Details:[/bold]")
                console.print(f"Iterations: {result.get('iteration', 0)}")
                console.print(f"Evaluation: {result.get('evaluation', {})}")
                
        except Exception as e:
            console.print(f"[red]✗ Error:[/red] {str(e)}")
            raise typer.Exit(1)

@app.command()
def ingest(
    path: str = typer.Argument(..., help="Directory or file path to ingest"),
    persist_dir: str = typer.Option("./chroma_db", help="Vector DB directory")
):
    """Ingest documents into RAG system"""
    console.print(f"[blue]Ingesting documents from:[/blue] {path}")
    
    try:
        ingestion = RAGIngestion(persist_dir=persist_dir)
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Processing documents...", total=None)
            
            if path.endswith(('.csv', '.txt', '.pdf', '.md')):
                ingestion.ingest_files([path])
            else:
                ingestion.ingest_directory(path)
            
            progress.update(task, completed=True)
        
        console.print("[green]✓ Ingestion completed[/green]")
        
    except Exception as e:
        console.print(f"[red]✗ Error:[/red] {str(e)}")
        raise typer.Exit(1)

@app.command()
def metrics():
    """Display system metrics"""
    try:
        summary = metrics_collector.get_summary()
        
        table = Table(title="System Metrics")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Queries", str(summary.get("total_queries", 0)))
        table.add_row("Successful", str(summary.get("successful", 0)))
        table.add_row("Success Rate", f"{summary.get('success_rate', 0):.2%}")
        table.add_row("Avg Duration", f"{summary.get('avg_duration_seconds', 0):.2f}s")
        table.add_row("Avg Iterations", f"{summary.get('avg_iterations', 0):.2f}")
        
        console.print(table)
        
        # Most used agents
        if summary.get("most_used_agents"):
            console.print("\n[bold]Most Used Agents:[/bold]")
            for agent, count in list(summary["most_used_agents"].items())[:5]:
                console.print(f"  • {agent}: {count}")
        
        # Most used tools
        if summary.get("most_used_tools"):
            console.print("\n[bold]Most Used Tools:[/bold]")
            for tool, count in list(summary["most_used_tools"].items())[:5]:
                console.print(f"  • {tool}: {count}")
                
    except Exception as e:
        console.print(f"[red]Error:[/red] {str(e)}")

@app.command()
def test():
    """Run system tests"""
    console.print("[blue]Running system tests...[/blue]\n")
    
    test_queries = [
        "What is 2 + 2?",
        "Analyze a sample dataset",
        "Explain machine learning"
    ]
    
    orchestrator = AgentOrchestrator()
    passed = 0
    failed = 0
    
    for query in test_queries:
        console.print(f"Testing: {query}")
        try:
            result = orchestrator.run(query)
            if result.get("response"):
                console.print("[green]✓ Passed[/green]")
                passed += 1
            else:
                console.print("[yellow]⚠ No response[/yellow]")
                failed += 1
        except Exception as e:
            console.print(f"[red]✗ Failed: {str(e)}[/red]")
            failed += 1
        console.print()
    
    console.print(f"\n[bold]Results:[/bold] {passed} passed, {failed} failed")

@app.command()
def logs(
    lines: int = typer.Option(50, "--lines", "-n", help="Number of lines to show"),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow log output")
):
    """View system logs"""
    import time
    
    try:
        if follow:
            console.print("[blue]Following logs (Ctrl+C to stop)...[/blue]\n")
            with open("logs/agent_system.log", "r") as f:
                f.seek(0, 2)  # Go to end
                while True:
                    line = f.readline()
                    if line:
                        console.print(line.strip())
                    else:
                        time.sleep(0.1)
        else:
            with open("logs/agent_system.log", "r") as f:
                all_lines = f.readlines()
                for line in all_lines[-lines:]:
                    console.print(line.strip())
                    
    except FileNotFoundError:
        console.print("[yellow]No logs found[/yellow]")
    except KeyboardInterrupt:
        console.print("\n[blue]Stopped following logs[/blue]")

if __name__ == "__main__":
    app()
