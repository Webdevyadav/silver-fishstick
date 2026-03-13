# RosterIQ AI Agent - Frequently Asked Questions (FAQ)

## Table of Contents

1. [General Questions](#general-questions)
2. [Getting Started](#getting-started)
3. [Using the System](#using-the-system)
4. [Data and Privacy](#data-and-privacy)
5. [Technical Questions](#technical-questions)
6. [Troubleshooting](#troubleshooting)
7. [Integration](#integration)
8. [Billing and Licensing](#billing-and-licensing)

## General Questions

### What is RosterIQ AI Agent?

RosterIQ is an autonomous AI agent system designed for healthcare insurance payers to analyze provider roster pipeline operations. It uses natural language processing, persistent memory, and advanced analytics to help operations teams monitor, troubleshoot, and optimize roster processing workflows.

### Who should use RosterIQ?

RosterIQ is designed for:
- Healthcare operations analysts
- Roster processing managers
- Data quality specialists
- Operations team members
- System administrators
- Healthcare executives needing operational insights

### What makes RosterIQ different from traditional analytics tools?

RosterIQ offers several unique capabilities:
- **Natural language queries**: Ask questions in plain English, no SQL required
- **Persistent memory**: The system remembers your sessions and learns over time
- **Proactive monitoring**: Automatic detection and alerting of operational issues
- **Evidence-based insights**: Every data point is fully attributed to its source
- **Real-time streaming**: See the AI's reasoning process as it works
- **Diagnostic procedures**: Standardized workflows for common investigations

### What data does RosterIQ analyze?

RosterIQ analyzes two primary datasets:
1. **Roster Processing Details**: File-level pipeline data including processing stages, error counts, retry attempts
2. **Operational Metrics**: Market-level aggregated metrics including error rates, processing times, quality scores

### Is RosterIQ HIPAA compliant?

Yes, RosterIQ is designed with HIPAA compliance in mind:
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Comprehensive audit logging of all data access
- Role-based access control (RBAC)
- Secure authentication with JWT tokens
- Data anonymization in logs and debugging

## Getting Started

### How do I get access to RosterIQ?

Contact your organization's IT administrator or RosterIQ account manager to request access. You'll receive:
- Login credentials
- Access to your organization's RosterIQ instance
- Initial training materials
- Support contact information

### Do I need technical skills to use RosterIQ?

No! RosterIQ is designed for non-technical users. You can:
- Ask questions in natural language
- Use pre-built diagnostic procedures
- View results in easy-to-understand visualizations
- No SQL, coding, or technical knowledge required

However, technical users can also:
- Access the REST API for integrations
- Use WebSocket for real-time updates
- Build custom workflows and automations

### How long does it take to learn RosterIQ?

Most users become productive within 30 minutes of training. The learning curve includes:
- **5 minutes**: Understanding the three-panel interface
- **10 minutes**: Asking basic questions and interpreting results
- **15 minutes**: Running diagnostic procedures
- **30+ minutes**: Advanced features like correlation analysis

### What training resources are available?

RosterIQ provides:
- Video tutorials (5-10 minutes each)
- User guide documentation
- Interactive in-app help
- Live training sessions (contact your administrator)
- Support team assistance

## Using the System

### How do I ask a good question?

**Good questions are**:
- Specific: "What is the error rate for commercial market in January?"
- Time-bound: "Show me processing delays in the past 7 days"
- Focused: "Which market segments have the highest rejection rates?"

**Avoid**:
- Too vague: "Are there problems?"
- Too broad: "Tell me everything about roster processing"
- Ambiguous: "What about the data?"

### What does the confidence score mean?

The confidence score (0-1) indicates how certain RosterIQ is about its analysis:
- **0.9-1.0**: Very high confidence - act on findings
- **0.7-0.89**: High confidence - verify and act
- **0.5-0.69**: Moderate confidence - investigate further
- **<0.5**: Low confidence - gather more data or rephrase query

Low confidence doesn't mean the answer is wrong - it means RosterIQ needs more information or the query is ambiguous.

### How do I interpret visualizations?

All visualizations in RosterIQ include:
- **Title**: What the chart shows
- **Axes labels**: What each axis represents
- **Legend**: Color coding and categories
- **Source attribution**: Where the data came from
- **Interactive tooltips**: Hover for detailed values

Click on any visualization to drill down into underlying data.

### What are diagnostic procedures?

Diagnostic procedures are standardized analytical workflows for common investigations:

1. **Triage Stuck ROS**: Analyzes files stuck in processing stages
2. **Record Quality Audit**: Examines data quality patterns and validation failures
3. **Market Health Report**: Generates comprehensive market-level health assessments
4. **Retry Effectiveness Analysis**: Evaluates retry operation success rates

These procedures follow proven methodologies and provide consistent, reproducible results.

### How does session continuity work?

RosterIQ remembers your work through sessions:
- Each login creates or resumes a session
- Your queries, context, and preferences are preserved
- When you return, RosterIQ detects what changed since your last visit
- Sessions help the system provide more relevant insights over time

You can have multiple sessions for different projects or investigations.

### Can I export results?

Yes! You can export:
- Query results as CSV or JSON
- Visualizations as PNG or SVG
- Full reports as PDF
- Source data for further analysis

All exports maintain source attribution and include metadata.

## Data and Privacy

### What data does RosterIQ store?

RosterIQ stores:
- **Episodic memory**: Your queries, responses, and session history
- **Procedural memory**: Diagnostic procedures and their execution history
- **Semantic memory**: Domain knowledge and learned patterns
- **Audit logs**: All system access and operations

RosterIQ does NOT store:
- Raw PHI (Protected Health Information)
- Individual patient data
- Provider personal information

### How long is data retained?

Default retention periods:
- **Session data**: 90 days
- **Query history**: 1 year
- **Audit logs**: 7 years (HIPAA requirement)
- **Diagnostic results**: 1 year
- **System logs**: 30 days

Administrators can configure retention policies based on organizational requirements.

### Who can see my queries and results?

Access is controlled by role-based permissions:
- **Your queries**: Only you and system administrators
- **Shared sessions**: Users you explicitly share with
- **Aggregated analytics**: Anonymized usage statistics for system improvement
- **Audit logs**: Security and compliance teams only

### Is my data encrypted?

Yes, all data is encrypted:
- **At rest**: AES-256 encryption for all stored data
- **In transit**: TLS 1.3 for all network communications
- **In memory**: Secure memory handling with automatic cleanup
- **Backups**: Encrypted backups with secure key management

