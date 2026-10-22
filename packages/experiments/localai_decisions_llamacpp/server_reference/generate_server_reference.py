#!/usr/bin/env python3
"""Writes tests/fixtures/server_reference.json: the answers of the server of llama.cpp to tests/fixtures/requests.json.

The server must be the same llama.cpp version as the one that llama-cpp-sys-2 builds (v0.6.0), so that the
results are equal and not only close. Build it once, outside the repository:

    git clone --depth 1 --branch v0.6.0 https://github.com/ggml-org/llama.cpp.git
    cd llama.cpp
    cmake -B build -DGGML_METAL=OFF -DGGML_BLAS=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release
    cmake --build build --target llama-server -j 8

Then, from the folder of the package:

    python3 server_reference/generate_server_reference.py --server /path/to/llama.cpp/build/bin/llama-server

The script sends each question alone. With several questions in one request, the server evaluates the
start that their prompts share only once, and that changes the last digits of the result (about 0.003 on
a probability); the package evaluates each prompt in full, as the server does for one question.

The script uses the model file Kev-0.8B-Q8_0.gguf of the Hugging Face cache; run the tests once before, so
that the cache has it. It needs only the standard library of Python.
"""

import argparse
import glob
import json
import os
import subprocess
import time
import urllib.request

PACKAGE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUESTS = os.path.join(PACKAGE, "tests", "fixtures", "requests.json")
OUTPUT = os.path.join(PACKAGE, "tests", "fixtures", "server_reference.json")
PORT = 18093


def find_model():
    cache = os.environ.get("HF_HUB_CACHE") or os.path.join(os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface")), "hub")
    files = glob.glob(os.path.join(cache, "models--ggml-org--Kev-0.8B-GGUF", "snapshots", "*", "Kev-0.8B-Q8_0.gguf"))
    if not files:
        raise SystemExit("Kev-0.8B-Q8_0.gguf is not in the Hugging Face cache; run the tests of the package once")
    return files[0]


def post(path, body):
    request = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", required=True, help="the llama-server program of llama.cpp v0.6.0")
    arguments = parser.parse_args()

    model = find_model()
    server = subprocess.Popen([arguments.server, "-m", model, "-ngl", "0", "--port", str(PORT), "-t", "8"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(120):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health") as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(1)
        version = subprocess.run([arguments.server, "--version"], capture_output=True, text=True).stderr.strip().splitlines()
        results = []
        for item in json.load(open(REQUESTS)):
            answers = {}
            input_tokens = 0
            for question_id, question in item["request"]["questions"].items():
                request = dict(item["request"], questions={question_id: question})
                response = post("/v1/systemone", request)
                answers[question_id] = response["answers"][question_id]
                input_tokens += response["usage"]["input_tokens"]
            results.append({"name": item["name"], "answers": answers, "usage": {"input_tokens": input_tokens, "output_tokens": 0}})
        output = {"server_version": version[0] if version else "", "model": "ggml-org/Kev-0.8B-GGUF:Q8_0", "results": results}
        with open(OUTPUT, "w") as file:
            json.dump(output, file, indent=2, ensure_ascii=False)
            file.write("\n")
        print(f"Wrote {len(results)} results to {OUTPUT}")
    finally:
        server.terminate()
        server.wait()


if __name__ == "__main__":
    main()
