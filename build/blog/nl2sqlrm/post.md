
There is a tendency, when something does not work, to blame the most complicated part of the system.

In a pipeline that involves a large language model, the model is almost always the most complicated part. It is also almost always the first thing that gets blamed when the output is wrong. A better model gets swapped in. The problem persists. Another model gets tried. Still wrong. The conclusion that gets drawn is that local models are simply not good enough for serious work.

That conclusion is worth questioning.

---

## What the Research Actually Suggests

The literature on NL2SQL — the problem of converting natural language questions into executable SQL queries — has been growing steadily since large language models became capable enough to attempt it seriously. What it consistently shows is that the gap between a model that performs well on this task and one that performs poorly is not primarily a function of model size or architecture. It is a function of context.

Models that are given rich, structured information about the schema they are querying — column names, data types, sample values, table relationships — produce dramatically more accurate SQL than models given the same question without that context. The accuracy difference between a well-prompted smaller model and a poorly-prompted larger one is not marginal. In several benchmarks it is larger than the accuracy difference between model families entirely.

This is a finding that should change how people think about the problem. The question is not which model to use. The question is what information to give the model before it has to answer.

---

## The Hallucination Is Not Random

When a language model generates SQL that references columns that do not exist or tables that were never defined, that failure is not random noise. It is a predictable response to insufficient context.

Models are trained to produce plausible outputs. In the absence of specific information about what columns exist in a given database, the model falls back on what is plausible given the question and whatever general knowledge about database structures it accumulated during training. It invents column names that sound reasonable because reasonable-sounding is what it has been optimised for in the absence of anything more specific.

This is not a bug in the model. It is the model doing exactly what it was designed to do with the information it was given. The problem is upstream. The model was not given enough information to do better.

When the schema is provided explicitly — when every column name, every data type, and a sample of the actual values are injected into the prompt before the question is asked — the model has no reason to invent anything. The specific information displaces the plausible fiction. Accuracy improves not because the model became smarter but because it was given something concrete to work with.

---

## What This Tells Us About Language Models More Broadly

The pattern observed in NL2SQL is not specific to SQL generation. It surfaces in any task where a model has to produce structured output that references specific entities from a known universe.

Code generation that references specific APIs, function names, or codebases benefits from the same approach. Document generation that needs to stay consistent with existing terminology and structure benefits from it. Any retrieval-augmented generation system is built on exactly this insight — that giving the model the specific information it needs, rather than relying on what it learned during training, produces more reliable outputs.

The underlying principle is about the relationship between specificity and accuracy. General knowledge, however extensive, is a poor substitute for specific context when the task requires specific answers. The model's training gives it a wide distribution of plausible responses. The context you provide narrows that distribution toward the correct one.

This reframes the prompt engineering problem in a useful way. The question is not how to instruct the model more cleverly. It is how to give the model the most specific and relevant information possible before it has to produce an output. Instruction matters. Context matters more.

---

## The Semantic Gap That Remains

Schema-aware prompting solves the hallucination problem for column names and table structures. It does not fully solve what might be called the semantic gap — the distance between what a user means when they ask a question in natural language and what a SQL query that answers that question actually looks like.

Natural language is ambiguous in ways that SQL is not. When someone asks for the top customers by order value, they might mean the top ten, or the top five percent, or just the ones above some threshold they have not stated. They might mean by total historical value or by value in the last quarter. They might mean individual customers or customer organisations that contain multiple accounts.

A model with schema context can write syntactically correct SQL for any of these interpretations. It cannot know which interpretation is correct without additional information. The current approach makes a reasonable default choice and executes it. A more sophisticated approach would identify the ambiguity, surface it to the user, and ask for clarification before proceeding.

This is an open research problem. The benchmarks that exist for NL2SQL evaluation — Spider, WikiSQL, BIRD — measure whether the generated SQL produces the correct output on a predefined set of questions with known correct answers. They do not measure how well systems handle genuinely ambiguous questions, which are the kind that appear most often in real use. The gap between benchmark performance and real-world performance in NL2SQL systems is partly explained by this mismatch.

---

## What a Proper Benchmark Would Look Like

The existing NL2SQL benchmarks are valuable but limited. They test accuracy on well-formed questions against schemas that were designed to be queried. Real data is messier. Real questions are more ambiguous. Real schemas have inconsistencies, poorly named columns, and structures that made sense to whoever designed them but that require domain knowledge to interpret correctly.

A benchmark that captured this would need to include questions that are genuinely ambiguous, schemas that reflect real-world messiness, and evaluation criteria that go beyond binary correct or incorrect. It would need to measure not just whether the SQL produced the right output but whether the system handled ambiguity gracefully, surfaced useful errors when the question could not be answered, and produced SQL that a human could verify and trust.

Building that benchmark is a tractable research contribution. The methodology is clear. The gap it would fill is real. The practical applications — in data tooling, in enterprise analytics, in any domain where non-technical users need to query structured data — are significant.

This field note exists because that research direction seems worth pursuing seriously. The groundwork is there. The questions are well-defined. The existing work is surprisingly thin on the practical side of the problem.

---

## A Note on Local Models

One dimension of this that deserves more attention in the research literature is the performance of smaller local models on NL2SQL tasks when given appropriate context.

Most published benchmarks use frontier models — GPT-4, Claude, Gemini. The accuracy numbers are impressive. But they tell us relatively little about what is achievable with models that run locally on consumer hardware, which is where privacy constraints make the problem most interesting and most practically relevant.

The preliminary evidence from building NL2SQL suggests that the gap between a well-prompted local model and a well-prompted frontier model on straightforward queries is smaller than the benchmark comparisons would imply. The frontier models have an advantage on complex nested queries and on queries that require genuine reasoning about ambiguous intent. On the large middle ground of practical analytical questions — aggregations, filters, joins across two or three tables — a local model with good schema context performs well enough to be genuinely useful.

That middle ground is where most real data work actually lives. It is worth understanding better.
