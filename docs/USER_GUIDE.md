# RosterIQ AI Agent - User Guide for Healthcare Operations Staff

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Understanding the Interface](#understanding-the-interface)
4. [Common Workflows](#common-workflows)
5. [Diagnostic Procedures](#diagnostic-procedures)
6. [Interpreting Results](#interpreting-results)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

## Introduction

Welcome to RosterIQ AI Agent - your intelligent assistant for healthcare provider roster pipeline operations. This guide will help you understand and effectively use the system to monitor, analyze, and optimize your roster processing operations.

### What is RosterIQ?

RosterIQ is an AI-powered analytics system designed specifically for healthcare insurance payers to:

- **Analyze roster processing pipelines** in natural language
- **Detect and alert** on operational issues proactively
- **Remember your sessions** and detect what changed since your last visit
- **Provide evidence-based insights** with full source attribution
- **Run diagnostic procedures** for common operational investigations

### Who Should Use This Guide?

This guide is designed for:
- Healthcare operations analysts
- Roster processing managers
- Data quality specialists
- Operations team members
- System administrators

## Getting Started

### Accessing the System

1. Navigate to the RosterIQ web application
2. Log in with your healthcare organization credentials
3. You'll see the three-panel interface:
   - **Left Panel**: Query input and history
   - **Center Panel**: Results and visualizations
   - **Right Panel**: Details and source attribution

### Your First Query

Try asking a simple question in natural language:

```
"What are the main issues with our roster processing?"
```

The system will:
1. Analyze your question
2. Query the relevant data
3. Provide insights with confidence scores
4. Show you the data sources used

### Understanding Sessions

RosterIQ remembers your work through **sessions**:

- Each time you log in, a new session starts
- Your queries and context are preserved
- When you return, the system detects what changed since your last visit
- Sessions help the system provide more relevant insights over time


## Understanding the Interface

### Three-Panel Layout

#### Left Panel: Query Input
- **Query Box**: Type your questions in natural language
- **Query History**: See your previous queries
- **Quick Actions**: Access common diagnostic procedures
- **Session Info**: View your current session details

#### Center Panel: Results Display
- **AI Response**: Natural language explanation of findings
- **Visualizations**: Charts and graphs showing trends
- **Confidence Scores**: How confident the system is in its analysis
- **Reasoning Steps**: See how the AI reached its conclusions

#### Right Panel: Detail View
- **Source Attribution**: Exact data sources used
- **Evidence**: Supporting data and calculations
- **Recommendations**: Actionable next steps
- **Related Queries**: Suggested follow-up questions

### Real-Time Streaming

When processing complex queries, you'll see:
- **Progress indicators** showing current analysis step
- **Streaming updates** as the AI works through the problem
- **Intermediate results** before final conclusions

You can cancel long-running operations at any time.

## Common Workflows

### Workflow 1: Daily Operations Check

**Goal**: Quick overview of roster processing health

**Steps**:
1. Log in to RosterIQ
2. Review the "What changed since last session" summary
3. Check for any proactive alerts (red badges)
4. Ask: "Show me today's processing summary"
5. Review key metrics and any anomalies

**Expected Time**: 2-3 minutes

**What to Look For**:
- Error rate changes
- Processing time increases
- New data quality issues
- Market segment problems


### Workflow 2: Investigating Specific Issues

**Goal**: Deep dive into a specific operational problem

**Steps**:
1. Start with a specific question: "Why are files stuck in validation stage?"
2. Review the AI's analysis and confidence score
3. Check the source attribution panel for data sources
4. If confidence is high (>0.7), review recommendations
5. If confidence is low, ask follow-up questions for clarification
6. Run relevant diagnostic procedure if suggested

**Expected Time**: 10-15 minutes

**Example Questions**:
- "Why is the error rate increasing in commercial market?"
- "Which provider types have the highest rejection rates?"
- "What's causing processing delays in the past week?"

### Workflow 3: Running Diagnostic Procedures

**Goal**: Execute standardized analysis for reporting

**Steps**:
1. Click "Diagnostic Procedures" in the left panel
2. Select the appropriate procedure:
   - **Triage Stuck ROS**: For stuck files
   - **Record Quality Audit**: For data quality issues
   - **Market Health Report**: For market overview
   - **Retry Effectiveness**: For retry analysis
3. Configure parameters (time window, market segment, etc.)
4. Click "Run Procedure"
5. Watch real-time progress updates
6. Review structured findings and recommendations
7. Export results if needed for reporting

**Expected Time**: 5-10 minutes

### Workflow 4: Monitoring Trends

**Goal**: Track key metrics over time

**Steps**:
1. Ask: "Show me error rate trends for the past 30 days"
2. Review the generated visualization
3. Click on data points for detailed information
4. Compare across market segments or provider types
5. Set up alerts for threshold breaches (if available)
6. Export visualization for presentations

**Expected Time**: 5-7 minutes

## Diagnostic Procedures

### Overview

RosterIQ provides four standardized diagnostic procedures. Each follows a proven analytical workflow and provides consistent results.

### When to Use Each Procedure

| Procedure | Use When | Output |
|-----------|----------|--------|
| Triage Stuck ROS | Files not progressing through pipeline | Bottleneck analysis, stuck file list |
| Record Quality Audit | High rejection rates or data quality concerns | Quality patterns, validation failures |
| Market Health Report | Need comprehensive market assessment | Market metrics, comparative analysis |
| Retry Effectiveness | Evaluating retry strategy performance | Success rates, cost-benefit analysis |

### Running a Diagnostic Procedure

**Via Natural Language**:
```
"Run triage stuck ROS for commercial market in the past 7 days"
```

**Via Diagnostic Panel**:
1. Click "Diagnostic Procedures" button
2. Select procedure from dropdown
3. Configure parameters
4. Click "Run"

### Understanding Diagnostic Results

All diagnostic procedures provide:
- **Findings**: Structured list of issues discovered
- **Severity Levels**: 1 (info) to 5 (critical)
- **Confidence Scores**: How certain the system is
- **Recommendations**: Actionable next steps
- **Evidence**: Supporting data and calculations

## Interpreting Results

### Confidence Scores

**What They Mean**:
- **0.9-1.0**: Very high confidence - act on findings immediately
- **0.7-0.89**: High confidence - verify and act
- **0.5-0.69**: Moderate confidence - investigate further before acting
- **<0.5**: Low confidence - gather more data or rephrase query

**Why Confidence Might Be Low**:
- Ambiguous query language
- Insufficient data for the time period
- Conflicting patterns in the data
- Query requires clarification

**What to Do**:
- Rephrase your question more specifically
- Provide additional context or constraints
- Ask follow-up questions
- Check if data is available for your criteria

### Source Attribution

Every piece of data in RosterIQ is fully attributed:
- **Dataset**: Which CSV file the data came from
- **Query**: The exact SQL query used
- **Timestamp**: When the data was retrieved
- **Record Count**: How many records were analyzed

**Why This Matters**:
- Verify the analysis is based on correct data
- Understand the scope of the analysis
- Reproduce results if needed
- Build trust in AI-generated insights

### Visualizations

RosterIQ automatically generates visualizations when appropriate:

**Chart Types**:
- **Trend Lines**: Time series data
- **Bar Charts**: Categorical comparisons
- **Scatter Plots**: Correlation analysis
- **Heatmaps**: Pattern visualization
- **Sankey Diagrams**: Process flow analysis

**Interacting with Charts**:
- Hover over data points for details
- Click to drill down into underlying data
- Export as PNG or SVG
- View source attribution

## Best Practices

### Asking Effective Questions

**Do**:
✅ Be specific: "What is the error rate for commercial market in January?"
✅ Include time frames: "Show me processing delays in the past 7 days"
✅ Specify segments: "Which provider types have highest rejection rates?"
✅ Ask follow-ups: "Why is that happening?"

**Don't**:
❌ Be too vague: "Are there problems?"
❌ Ask multiple questions at once: "Show me everything about errors, delays, and quality"
❌ Use technical jargon unnecessarily: "SELECT * FROM..."

### Working with Sessions

**Tips**:
- Start a new session for each major investigation
- Review "what changed" summaries when returning
- Use session history to track your analysis path
- Share sessions with team members for collaboration

### Handling Alerts

When you see alerts (red badges):
1. **Read the alert message** - understand what was detected
2. **Check severity** - prioritize critical (5) and high (4) alerts
3. **Review recommendations** - follow suggested actions
4. **Investigate further** - ask follow-up questions if needed
5. **Document actions** - note what you did to resolve

### Data Quality Checks

Before trusting results:
- ✅ Check confidence scores
- ✅ Review source attribution
- ✅ Verify time periods match your intent
- ✅ Confirm market segments are correct
- ✅ Look for data quality warnings

## Troubleshooting

### "No results found"

**Possible Causes**:
- Date range too narrow
- Market segment doesn't exist
- Data not loaded for time period

**Solutions**:
- Broaden your time range
- Check available market segments
- Ask: "What data is available?"

### "Low confidence score"

**Possible Causes**:
- Ambiguous question
- Insufficient data
- Conflicting patterns

**Solutions**:
- Rephrase more specifically
- Add more context
- Ask clarifying questions

### "Connection lost"

**Possible Causes**:
- Network interruption
- Session timeout
- Server maintenance

**Solutions**:
- Refresh the page
- Check your internet connection
- Wait a moment and try again
- Contact support if persistent

### "Slow response times"

**Possible Causes**:
- Complex query
- Large dataset
- High system load

**Solutions**:
- Narrow your query scope
- Use smaller time windows
- Try during off-peak hours
- Enable streaming for progress updates

## FAQ

### How often is data updated?

Data is typically updated:
- **Roster processing details**: Hourly
- **Operational metrics**: Daily
- **State changes**: Detected in real-time

### Can I export results?

Yes! You can export:
- Query results as CSV or JSON
- Visualizations as PNG or SVG
- Full reports as PDF

### How long is my history saved?

- **Query history**: 90 days
- **Session data**: 90 days
- **Diagnostic results**: 1 year

### Can I share my analysis with colleagues?

Yes! You can:
- Share session links
- Export results
- Collaborate in shared sessions (if enabled)

### Is my data secure?

Yes! RosterIQ uses:
- Encryption at rest and in transit
- Role-based access control
- Comprehensive audit logging
- HIPAA-compliant infrastructure

### What if I find an error in the results?

If you believe results are incorrect:
1. Check the source attribution
2. Verify your query was interpreted correctly
3. Contact support with the request ID
4. Provide specific details about the discrepancy

## Getting Help

### In-App Help

- Click the "?" icon for contextual help
- Hover over elements for tooltips
- Check suggested queries for examples

### Support Channels

- **Email**: support@rosteriq.com
- **Phone**: 1-800-ROSTER-IQ
- **Chat**: Available in-app during business hours
- **Documentation**: https://docs.rosteriq.com

### Training Resources

- Video tutorials (5-10 minutes each)
- Live training sessions (contact your administrator)
- User community forum
- Monthly webinars

---

**Next Steps**:
1. Try asking your first question
2. Run a diagnostic procedure
3. Explore the visualization features
4. Set up alerts for your key metrics

**Need More Help?**
- Check the [FAQ](FAQ.md)
- Review [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
- Contact support@rosteriq.com

**Last Updated**: January 2024
