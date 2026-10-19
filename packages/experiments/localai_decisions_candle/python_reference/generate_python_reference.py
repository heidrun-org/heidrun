"""Generate the Python reference results that the Rust tests compare with.

The script runs the Python package gliner2 on the examples in tests/fixtures/examples.json and writes
tests/fixtures/python_reference.json. For each example it saves the subword identifiers that the model reads, the
raw logit of every label, the probability of every label, and the result of classify_text. It also refreshes the
words that the Python word splitter finds in each text of tests/fixtures/word_splits.json.

The first 21 examples come from the model card. The other examples cover edge cases of the Rust code: long text,
other languages, web addresses, and descriptions of labels. Add an example to examples.json and run the script again.

Run it only to refresh the reference file. It needs the extra "local" of gliner2 and downloads the model
fastino/GLiNER2.5-Decide (1.9 GB) the first time:

    uv venv --python 3.12 venv && uv pip install --python venv/bin/python "gliner2[local]"
    venv/bin/python python_reference/generate_python_reference.py
"""

import json
import pathlib
import sys

import torch
from gliner2 import AutoExtractor
from gliner2.processing.word_splitter import WhitespaceTokenSplitter

MODEL_IDENTIFIER = "fastino/GLiNER2.5-Decide"
PACKAGE_FOLDER = pathlib.Path(__file__).resolve().parent.parent
EXAMPLES_FILE = PACKAGE_FOLDER / "tests" / "fixtures" / "examples.json"
REFERENCE_FILE = PACKAGE_FOLDER / "tests" / "fixtures" / "python_reference.json"
WORD_SPLITS_FILE = PACKAGE_FOLDER / "tests" / "fixtures" / "word_splits.json"


def score_example(model, text, tasks):
    """Return the subword identifiers and, for each task, the logit and the probability of each label."""
    schema = model._classification_schema(tasks)
    batch = model.processor.collate_fn_inference([(text, schema)], architecture="span")
    encoded = model.encode_tokens(batch, None)
    _, schema_embeddings = model.processor.extract_embeddings_from_batch(encoded, batch.input_ids, batch)
    input_ids = batch.input_ids[0].tolist()

    scored_tasks = []
    classifications = schema.schema["classifications"]
    for task_index, tokens in enumerate(batch.schema_tokens_list[0]):
        label_names = [tokens[i + 1] for i in range(len(tokens) - 1) if tokens[i] == "[L]"]
        label_embeddings = torch.stack(list(schema_embeddings[0][task_index][1:]))
        logits = model.classifier(label_embeddings).squeeze(-1)
        is_multi_label = classifications[task_index].get("multi_label", False)
        probabilities = torch.sigmoid(logits) if is_multi_label else torch.softmax(logits, dim=-1)
        scored_tasks.append(
            {
                "task": classifications[task_index]["task"],
                "schema_tokens": tokens,
                "labels": label_names,
                "logits": [float(value) for value in logits],
                "probabilities": [float(value) for value in probabilities],
            }
        )
    return input_ids, scored_tasks


def refresh_word_splits():
    """Rewrite the words that the Python word splitter finds in each text of word_splits.json."""
    splitter = WhitespaceTokenSplitter()
    cases = json.loads(WORD_SPLITS_FILE.read_text())
    for case in cases:
        case["words"] = [word for word, _, _ in splitter(case["text"], lower=True)]
    WORD_SPLITS_FILE.write_text(json.dumps(cases, indent=1, ensure_ascii=False) + "\n")


def main():
    examples = json.loads(EXAMPLES_FILE.read_text())
    model = AutoExtractor.from_pretrained(MODEL_IDENTIFIER)
    model.eval()
    reference = []
    with torch.inference_mode():
        for example in examples:
            input_ids, scored_tasks = score_example(model, example["text"], example["tasks"])
            result = model.classify_text(example["text"], example["tasks"], include_confidence=True)
            reference.append(
                {
                    "name": example["name"],
                    "input_ids": input_ids,
                    "tasks": scored_tasks,
                    "result": result,
                }
            )
            print(example["name"], json.dumps(result, ensure_ascii=False), file=sys.stderr)
    refresh_word_splits()
    REFERENCE_FILE.write_text(json.dumps(reference, indent=1, ensure_ascii=False) + "\n")


main()
