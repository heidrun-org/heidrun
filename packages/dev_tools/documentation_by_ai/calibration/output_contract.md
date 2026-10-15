# Single-source output instruction

For every source-dependent finding, source must be exactly ONE existing repository-relative file path as a string. Never join multiple paths with semicolons, commas or newlines, and never supply an array. Choose the primary source that directly supports the finding; describe any additional source files and evidence in sourceEvidence. Use null only when the finding is not source-dependent. This is an output-format requirement; evidence, severity and rubric version 3 are unchanged.

Added to both calibration and actual-page experiment runners. Existing source validation and rubric are unchanged. Failed outputs will be preserved without silent splitting or score changes.
