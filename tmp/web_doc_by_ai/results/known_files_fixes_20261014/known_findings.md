# Verified findings to correct

1. Relative copying uses the Git repository root, not necessarily the workspace folder. With a workspace set to the repository docs subfolder, copying README.md yielded docs/README.md in the notification and in an actual clipboard paste. Correct Copy a file path and Files sidebar section controls. Describe a repository-subfolder example clearly and cite the captured implementation.
2. New workspace… adds the chosen folder to the workspace list without selecting it. An explicit click on the new workspace entry selected the workspace. Browse and open project files must include this step.

These findings come from the prior real native application verification, preserved in ../live_files_verification and ../../process/HANDOFF.md. Do not re-run the application or replace screenshots in this writing run. Keep all existing screenshot assets. Verify claims against the captured source; report any conflict rather than inventing behaviour.
