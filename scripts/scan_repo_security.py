import os
import re

PATTERNS = [
    ("Credential/Key", re.compile(r'(?i)(password|secret_key|api_key|access_token|private_key)\s*[:=]\s*[\'"][^\'"]+[\'"]')),
    ("Local User Path", re.compile(r'c:[\\/]users[\\/]azoua', re.IGNORECASE)),
    ("GitHub Token", re.compile(r'ghp_[a-zA-Z0-9]{36}')),
    ("AWS Key", re.compile(r'AKIA[0-9A-Z]{16}'))
]

found = []
ignore_dirs = {'.git', 'node_modules', 'dist', 'dist-release', '.venv', '__pycache__', '.pytest_cache', '.gemini', 'floorplan'}
ignore_exts = {'.parquet', '.png', '.jpg', '.zip', '.woff2', '.ttf', '.pdf', '.docx', '.ico', '.cache'}

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in ignore_exts:
            continue
        filepath = os.path.join(root, f)
        try:
            if os.path.getsize(filepath) > 1024 * 1024: # >1MB
                continue
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                for idx, line in enumerate(fp, 1):
                    for label, pat in PATTERNS:
                        if pat.search(line):
                            found.append((label, filepath, idx, line.strip()[:120]))
        except Exception:
            pass

print(f"Total potential security/path findings: {len(found)}")
for label, fp, line_no, content in found:
    print(f"[{label}] {fp}:{line_no} -> {content}")
