import subprocess

def run_cmd(args):
    return subprocess.check_output(args, text=True).strip()

commits = run_cmd(["git", "log", "--format=%H|%s"]).splitlines()
print(f"Total commits: {len(commits)}")

track_b_keywords = [
    "gi_terroir", "time_use", "cultural_climate", "scanner_derived",
    "retail_scanner", "consumer_behavior_pulse", "subnational_hicp",
    "empirical_microdata_plate", "food_security_nowcast"
]

for line in commits:
    h, s = line.split("|", 1)
    files = run_cmd(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", h]).splitlines()
    found_b = [f for f in files if any(k in f for k in track_b_keywords)]
    found_p = [f for f in files if f.startswith("paper/")]
    if found_b or found_p:
        print(f"\nCommit {h[:7]} - {s}")
        if found_b:
            print("  Track B files:")
            for f in found_b:
                print(f"    - {f}")
        if found_p:
            print("  Paper files:")
            for f in found_p:
                print(f"    - {f}")
