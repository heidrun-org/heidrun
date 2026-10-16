# Guards

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained reference of the guards
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 589](https://github.com/heidrun-org/heidrun/issues/589)

Heidrun checks a command before it types the command in a terminal. This check is called the guards. A command that a guard stops is never sent on a single click: Heidrun opens a confirmation window that shows the command and the reason, and the developer confirms or cancels.

## Which commands pass the guards

- A launcher of the Launchers sidebar section.
- A prompt that starts with `!`, which a coding agent runs in a shell.
- The answer to a menu of a coding agent that runs a command.
- A command sent from the phone, and a command typed in a plain terminal from the phone. The phone shows its own confirmation.

## The built-in guards

The list of the built-in guards is in the file [guards.ts](../../packages/apps/web_frontend/src/lib/guards.ts). Each built-in guard asks the developer to confirm. A built-in guard never blocks a command. The test [guards_document.test.ts](../../packages/apps/web_frontend/src/lib/guards_document.test.ts) fails when a built-in guard is missing from this table, or when the reason in this table is not the reason that Heidrun shows.

| Key | Reason that Heidrun shows | Commands that the guard stops |
| --- | --- | --- |
| `guards.why.deleteFiles` | deleting files (rm -r / -f) | `rm` with the option `-r`, `-R`, `-f`, `--recursive`, or `--force`. Example: `rm -rf node_modules`. |
| `guards.why.deleteFilesAsRoot` | deleting files as root (sudo rm) | `sudo rm`, with or without an option. |
| `guards.why.findDelete` | deleting files (find -delete) | `find` with the option `-delete`, or with `-exec rm`. |
| `guards.why.shred` | erasing files for good | `shred` and `srm`. |
| `guards.why.dockerPrune` | Docker cleanup (prune) | `prune` with `-a`, `-af`, or `--all`, and `system prune`. Example: `docker system prune -af`. |
| `guards.why.dockerForceRemove` | forced Docker removal | `docker rm`, `docker rmi`, or `docker volume rm` with the option `-f`. |
| `guards.why.forcePush` | force push or deletion of a remote branch | `git push` with `--force`, `-f`, `--force-with-lease`, a branch that starts with `+`, `--delete`, `-d`, or a refspec of the form `:branch`. |
| `guards.why.gitResetHard` | git reset --hard (changes lost) | `git reset --hard`. |
| `guards.why.gitClean` | git clean -f (untracked files deleted) | `git clean` with the option `-f`, alone or with other letters, for example `-fd`. |
| `guards.why.deleteBranch` | deleting a branch | `git branch -D`. |
| `guards.why.discardChanges` | local changes discarded | `git checkout -f`, `git checkout -- .`, `git restore .`, `git stash clear`, and `git stash drop`. |
| `guards.why.sqlDrop` | SQL deletion (DROP / TRUNCATE) | `DROP` or `TRUNCATE` of a `TABLE`, a `DATABASE`, or a `SCHEMA`, in upper case or in lower case. |
| `guards.why.sqlDeleteWithoutWhere` | DELETE without WHERE | `DELETE FROM` a table with no `WHERE` clause. Example: `DELETE FROM users;`. |
| `guards.why.formatDisk` | formatting a disk | `mkfs`, `fdisk`, and `diskutil erase`. |
| `guards.why.rawDiskWrite` | raw write to a disk (dd) | `dd` with the option `of=`. |
| `guards.why.deviceWrite` | writing to a device | A redirection `>` to `/dev/disk`, `/dev/sd`, or `/dev/nvme`. |
| `guards.why.recursivePermissions` | permissions changed recursively | `chmod 777`, `chmod -R 777`, and `chown -R`. |
| `guards.why.kubernetesDelete` | Kubernetes deletion | `kubectl delete`, `kubectl uninstall`, `helm delete`, and `helm uninstall`. |
| `guards.why.terraformDestroy` | destructive terraform | `terraform destroy`, and `terraform apply` with `-auto-approve`. |
| `guards.why.mergeRequest` | merging a merge request / pull request | `gh pr merge` and `glab mr merge`. |
| `guards.why.production` | action on production | A command that has the word `prod` or `production` and one of the words `rm`, `drop`, `delete`, `restart`, `stop`, or `down`, in any order. |

A `git` command with the option `-C <folder>` or `-c <setting>` before the subcommand is stopped in the same way. Example: `git -C ../other push --force`.

## The key `guards` of the file `.heidrun/config.json`

A project adds its own guards in the file `.heidrun/config.json` at the root of the repository, under the key `guards`. The key has two lists. Each list holds patterns, and each pattern is a regular expression of JavaScript, written as a string, that ignores the case.

- `confirm`: a command that matches asks the developer to confirm. The reason is "project pattern" and the pattern.
- `block`: a command that matches never runs from Heidrun. The confirmation window shows the reason "forbidden by the project" and the pattern, and has no button to confirm.

Example:

```json
{
	"version": 1,
	"launchers": [],
	"guards": {
		"confirm": [
			"\\bnpm\\s+publish\\b"
		],
		"block": [
			"\\bdeploy\\.sh\\s+--prod\\b"
		]
	}
}
```

### The order of the checks

1. Heidrun replaces each run of spaces in the command with one space, and removes the spaces at the start and at the end.
2. When the file `.heidrun/config.json` exists but is not valid JSON, or does not follow the schema, every command asks for a confirmation, because the `block` patterns cannot be read.
3. The `block` patterns. The first pattern that matches blocks the command.
4. The `confirm` patterns. The first pattern that matches asks for a confirmation.
5. The built-in guards, in the order of the table above. The first guard that matches asks for a confirmation.
6. When nothing matches, the command is sent.

So a `block` pattern wins over a `confirm` pattern, and both win over the built-in guards. A pattern that is not a valid regular expression is ignored. Heidrun reads the key again at most one minute after a change of the file.
