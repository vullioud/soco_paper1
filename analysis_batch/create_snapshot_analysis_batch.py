import os
from datetime import datetime

# --- Configuration ---

START_DIRECTORY = '.'

TRACKED_EXTENSIONS = (".js", ".R", ".r")

# Directories to ignore everywhere (tree + file collection)
IGNORED_DIRS = {
    ".git",
    ".vscode",
    "node_modules",
    "__pycache__",
    "renv",
    ".Rproj.user"
}

timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
OUTPUT_FILENAME = f"analysis_batch_mod_snapshot_{timestamp}.txt"

# --- Helper Functions ---

def build_tree(root_path):
    """
    Builds a directory tree representation starting from root_path,
    excluding ignored directories.
    """
    tree_lines = []
    base_depth = root_path.rstrip(os.sep).count(os.sep)

    for dirpath, dirnames, filenames in os.walk(root_path):
        # Remove ignored directories in-place
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

        depth = dirpath.count(os.sep) - base_depth
        indent = "│   " * depth
        tree_lines.append(f"{indent}├── {os.path.basename(dirpath)}/")

        for filename in sorted(filenames):
            tree_lines.append(f"{indent}│   ├── {filename}")

    return "\n".join(tree_lines)

# --- Script Logic ---

def create_recursive_snapshot():
    start_path = os.path.abspath(START_DIRECTORY)
    parent_path = os.path.abspath(os.path.join(start_path, ".."))
    output_path = os.path.join(start_path, OUTPUT_FILENAME)

    print(f"Starting recursive search in: {start_path}")
    print(f"Ignoring directories: {', '.join(sorted(IGNORED_DIRS))}")
    print(f"Tracking extensions: {TRACKED_EXTENSIONS}")

    # 1. Build project tree
    tree = build_tree(parent_path)

    # 2. Find tracked files
    tracked_files = []
    for dirpath, dirnames, filenames in os.walk(start_path):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

        for filename in filenames:
            if filename.endswith(TRACKED_EXTENSIONS):
                tracked_files.append(os.path.join(dirpath, filename))

    tracked_files.sort()
    print(f"Found {len(tracked_files)} source files to process.")

    # 3. Write snapshot
    with open(output_path, 'w', encoding='utf-8') as outfile:

        outfile.write("/*\n")
        outfile.write("PROJECT TREE (one level above start directory)\n")
        outfile.write("================================================\n")
        outfile.write(tree)
        outfile.write("\n*/\n\n")

        for i, full_path in enumerate(tracked_files):
            relative_path = os.path.relpath(full_path, start_path)
            header_path = relative_path.replace(os.sep, '/')

            outfile.write(f"// ----- Start of File: {header_path} -----\n\n")

            try:
                with open(full_path, 'r', encoding='utf-8') as infile:
                    outfile.write(infile.read())
            except Exception as e:
                msg = f"!!! ERROR: Could not read file '{full_path}'. Reason: {e} !!!"
                print(f"Warning: {msg}")
                outfile.write(msg)

            outfile.write(f"\n\n// ----- End of File: {header_path} -----")

            if i < len(tracked_files) - 1:
                outfile.write("\n\n============================================================\n\n")

    print(f"\nSnapshot created:\n{output_path}")

# --- Entry Point ---

if __name__ == "__main__":
    create_recursive_snapshot()
