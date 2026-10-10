import { z } from "zod";

// Schema of the project configuration file `.heidrun/config.json`, at the root of the repository.
// Every object is strict: an unknown field is a typo, and the file is rejected with its path.

/** A custom script of the tab Scripts. It is stored under the key `actions`, which keeps older files valid. */
export const actionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  /** Optional sub-folder, relative to the project root. */
  cwd: z.string().optional(),
});

/** The `references` section: how `#12`, `!34` and `ABC-123` become links. */
export const referencesSchema = z.strictObject({
  forge: z.enum(["github", "gitlab"]).optional(),
  repo: z.string().min(1).optional(),
  tickets: z
    .union([
      z.string().min(1),
      z.strictObject({
        url: z.string().min(1).optional(),
        prefixes: z.array(z.string().min(1)).optional(),
      }),
    ])
    .optional(),
  enabled: z.boolean().optional(),
});

/** The `guards` section: commands that ask for a confirmation, and commands that are blocked. */
export const guardsSchema = z.strictObject({
  confirm: z.array(z.string()).optional(),
  block: z.array(z.string()).optional(),
});

/** A prompt template of the project. */
export const promptSchema = z.strictObject({
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  text: z.string().min(1),
});

/** The whole content of `.heidrun/config.json`. */
export const projectConfigSchema = z.strictObject({
  version: z.literal(1),
  actions: z.array(actionSchema).default([]),
  references: referencesSchema.optional(),
  guards: guardsSchema.optional(),
  prompts: z.array(promptSchema).optional(),
});

export type Action = z.infer<typeof actionSchema>;
export type ProjectReferences = z.infer<typeof referencesSchema>;
export type ProjectGuardsConfig = z.infer<typeof guardsSchema>;
export type ProjectPrompt = z.infer<typeof promptSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/** One line per problem, each starting with the path of the field: `actions.0.command: Too small…`. */
function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`).join("; ");
}

/** Validates a configuration read from the file, or about to be written to it. Throws an Error that names the fields. */
export function parseProjectConfig(value: unknown): ProjectConfig {
  const result = projectConfigSchema.safeParse(value);
  if (result.success === false) {
    throw new Error(describeIssues(result.error));
  }
  return result.data;
}

/** Validates the `references` section alone. Throws an Error that names the fields. */
export function parseReferences(value: unknown): ProjectReferences {
  const result = referencesSchema.safeParse(value);
  if (result.success === false) {
    throw new Error(describeIssues(result.error));
  }
  return result.data;
}
