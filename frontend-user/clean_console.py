import os

def walk_and_clean(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                
                changed = False
                new_lines = []
                for line in lines:
                    if "console.log(" in line:
                        changed = True
                    else:
                        new_lines.append(line)
                
                if changed:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.writelines(new_lines)
                    print(f"Cleaned {file_path}")

walk_and_clean(".")
