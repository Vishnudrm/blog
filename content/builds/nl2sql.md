---
title: "NL2SQL — Querying Your Data in Plain English, Entirely Offline"
date: "2026-09-28"
category: "Data Engineering"
section: "builds"
description: "A deep dive into building a local LLM-powered CLI that converts natural language into SQL using Ollama, DuckDB, and schema-aware prompting. No cloud. No API keys. No data leaves your machine."
tags: ["data-engineering", "llm", "sql", "python", "duckdb", "ollama", "cli"]
readingTime: true
draft: false
---

There is a question that comes up constantly in data work.

Someone has a spreadsheet. Or a CSV. Or an Excel file with seventeen sheets and a naming convention that made sense to whoever created it three years ago. They have a question about that data. A simple one. Something like — which region had the highest revenue last quarter, or how many orders came in after the price change.

They cannot write SQL. They should not have to learn SQL just to answer one question about their own data. And sending that data to an AI API means sending it to someone else's server, which is a conversation nobody wants to have when the data is sensitive.

NL2SQL exists because that gap bothered me enough to do something about it.

---

## The Problem With the Obvious Solution

The obvious solution is to call GPT-4 or Claude via API, forward the question, and get SQL back. It works. The quality is genuinely good. But it comes with a cost that goes beyond the API bill.

Every question you ask takes your data with it. The column names, the sample values, the schema — all of it leaves your machine and travels to a server you do not control. For personal projects that might be acceptable. For anything that touches real business data, customer records, or internal financial information, it is not.

Privacy was not a feature added at the end of this project. It was the first requirement. Everything else was designed around it.

---

## What It Does

NL2SQL is a command-line tool. You point it at one or more CSV or Excel files. You ask a question in plain English. It writes the SQL, validates it, runs it against your data, and returns the answer. The entire process happens on your machine. Nothing touches the internet.

The experience from the outside is simple. The engineering underneath it is not.

---

## The Architecture

Understanding how NL2SQL works requires understanding what actually happens between the moment a user types a question and the moment an answer appears on screen. There are five distinct stages, and the interesting problems live inside each of them.

### File Loading and Schema Extraction

The first thing the tool does when you load a file is not read the data. It reads the structure of the data. Every column name is extracted. Every data type is inferred from the actual values in the column rather than from metadata, because metadata lies more often than you would expect. Three to five representative sample values are pulled from each column to give the language model a concrete sense of what the data looks like.

This schema extraction step is what makes everything else work. Without it, the model is operating blind — making reasonable guesses about column names that may or may not exist, inventing table structures that sound plausible but are entirely wrong. With it, the model has everything it needs to write accurate SQL before it has seen a single character of the actual question.

DuckDB handles the file loading. It reads CSV and Excel files natively, in-process, without a server, without configuration, without loading anything into a separate database. Each loaded file becomes a DuckDB table in memory. When multiple files are loaded, they become separate tables that can be queried independently or joined together.

### Prompt Construction

Once the schema is extracted, the prompt is built. This is not a simple template with the question dropped in. It is a structured document that gives the model a complete and unambiguous picture of what it is working with.

The prompt specifies every available table by name. For each table it lists every column, the inferred type of that column, and the sample values extracted in the previous step. It then states the question. And it includes explicit constraints — use only the column names listed, do not reference any table or column not shown, return only the SQL query and nothing else.

That last constraint matters more than it sounds. Without it, models have a tendency to explain their reasoning, add caveats, or wrap the SQL in markdown code blocks that break downstream parsing. The constraint eliminates that class of problem entirely.

### Local LLM Inference via Ollama

The constructed prompt goes to Ollama running locally. The model used is qwen3:8b, which runs comfortably on consumer hardware and produces SQL that is accurate enough to be genuinely useful when given sufficient schema context.

Ollama manages the model lifecycle. NL2SQL manages the Ollama lifecycle — if Ollama is not running when the tool starts, it starts it. When the session ends, it handles the cleanup. The user never has to think about process management.

The choice of qwen3:8b was not arbitrary. Smaller models struggle with complex multi-table queries. Larger models require hardware that most people do not have. qwen3:8b sits at a point where the accuracy is high enough to be useful and the hardware requirements are low enough to be practical.

### SQL Validation

The SQL that comes back from the model goes through sqlglot before it goes anywhere near DuckDB. sqlglot parses the query, checks it for syntactic correctness, and normalises it into a form that DuckDB can execute reliably.

This validation step exists because models make mistakes. Not often, with good prompting — but often enough that running unvalidated SQL against a database would be uncomfortable. sqlglot catches syntax errors, malformed queries, and dialect mismatches before they cause problems.

What sqlglot does not catch is semantic errors. A query can be syntactically perfect and still reference a column that does not exist in the schema. That class of error requires a different kind of validation — one that checks the query against the actual schema rather than just parsing its structure. That semantic validation layer is the most significant piece of work still to be done on this project.

### Execution and Output

Once the SQL passes validation it goes to DuckDB for execution. The result comes back as a dataframe, which is printed to the terminal in a readable format. If the user wants to save the result, it can be exported to CSV or Excel with a single flag.

The execution step is the simplest part of the pipeline. DuckDB is fast, reliable, and handles the kinds of queries that come out of a natural language interface without complaint. The complexity that looked like it would live here ended up living almost entirely in the prompt construction step instead.

---

## The Multi-File Problem

Single file queries are straightforward. The interesting engineering problem appeared when multi-file JOIN queries were added.

Loading multiple files as separate DuckDB tables is simple. Writing SQL that joins them is also simple, for the model. The problem is data quality at the join boundary.

The same logical concept stored in two different files will sometimes have different types. An order identifier that is an integer in one file and a string in another. A date that is formatted one way in a CSV and a different way in an Excel sheet. When DuckDB tries to join on those mismatched columns it throws a raw type conversion error that tells the user nothing useful about what actually went wrong.

The solution was a join-key detector that runs before any query is executed. It scans all loaded tables for columns that share the same name, checks their inferred types, and flags any mismatches it finds. When a mismatch is detected the user is told which columns are affected and what the type conflict is. They are offered the option to let the tool attempt automatic coercion before the query runs.

The detection works reliably. The automatic coercion works in most cases — casting to a common string type resolves the mismatch well enough for the query to execute. Where it falls short is on numeric comparisons that require the original types to be preserved. A proper type resolution strategy that understands the semantics of the join rather than just the surface types is the next planned improvement.

---

## Chat Mode

A single question is often not enough for exploratory analysis. The first answer raises another question. That question raises another. Following that chain of questions with a tool that forgets everything between invocations is frustrating.

Chat mode was built to solve this. It maintains the context of previous questions and answers across a session so that follow-up questions can reference what came before. The conversation stays coherent. The user does not have to repeat context they already established.

The implementation keeps a running history of question and answer pairs and includes the relevant parts of that history in the prompt for each new question. The challenge is keeping the prompt from growing indefinitely as the conversation lengthens. The current approach truncates older context when the prompt approaches a size that would affect model performance, keeping the most recent exchanges and dropping the oldest.

---

## The CLI

The command-line interface was built with Typer. The design goal was for the tool to feel conversational rather than mechanical. A tool that requires you to remember exact flag syntax and file paths is a tool that gets used once and then forgotten.

The interactive mode handles this. Run the tool with no arguments and it scans the current directory for CSV and Excel files, lists what it finds, and walks you through selecting which ones to load. The question prompt follows naturally. The whole interaction feels more like a conversation than a command.

The tool is distributed via pipx, which installs it into an isolated environment and makes it available as a global command from anywhere on the system. Installation is a single command. It works everywhere without affecting anything else installed on the machine.

---

## Testing

The validator module has eleven pytest tests covering SQL parsing, dialect handling, edge cases in sqlglot validation, and error recovery paths. The tests exist not because the validator is complicated but because the consequences of silent validation failures are worse than the consequences of most other failures in the pipeline. Bad SQL reaching DuckDB is a worse outcome than a clear error message reaching the user.

The test coverage on the rest of the codebase is thinner than it should be. The prompt construction logic in particular has no automated tests. Testing it properly requires a consistent benchmark dataset with known correct SQL outputs — something that does not exist yet for this project but that would make the most significant difference to the reliability of the overall system.

---

## What This Project Is Really About

NL2SQL is a data engineering project on the surface. The pipeline, the DuckDB integration, the CLI design — those are the visible parts. But the core problem this project spent most of its time solving was a prompt engineering problem.

The difference between a model that produces correct SQL sixty percent of the time and one that produces it ninety percent of the time is not the model. It is the information the model is given before it has to answer. Schema context, explicit constraints, concrete examples — these things matter more than model size within a reasonable range.

That is a general principle that extends well beyond SQL generation. Any task where a model has to produce structured output that references specific entities from a known universe benefits from the same approach. Give the model the universe explicitly. Constrain the output format precisely. Remove every opportunity for plausible but incorrect improvisation.

This project is also the strongest candidate for a research direction — benchmarking NL2SQL accuracy systematically across model sizes, prompt strategies, and query complexity categories. The groundwork is there. The question of how much of the accuracy difference is attributable to the model versus the prompt is one worth answering properly.

---

## Links

- [GitHub →](https://github.com/Vishnudrm/nl2sql)
