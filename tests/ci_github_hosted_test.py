"""Exercise the hosted dispatch task without contacting GitHub."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


TASK = Path(__file__).resolve().parents[1] / "mise-tasks/ci/github-hosted.sh"


class HostedDispatchTest(unittest.TestCase):
  def setUp(self):
    self.assertTrue(TASK.is_file(), "hosted dispatch task must exist")
    self.scratch = tempfile.TemporaryDirectory()
    self.addCleanup(self.scratch.cleanup)
    self.root = Path(self.scratch.name)
    self.log = self.root / "argv.json"
    gh = self.root / "gh"
    gh.write_text(
      f"#!{sys.executable}\n"
      "import json, os, pathlib, sys\n"
      "pathlib.Path(os.environ['GH_TEST_ARGV']).write_text(json.dumps(sys.argv[1:]))\n"
      "raise SystemExit(int(os.environ.get('GH_TEST_EXIT', '0')))\n",
      encoding="utf-8",
    )
    gh.chmod(0o755)
    self.env = dict(os.environ, PATH=f"{self.root}:{os.environ['PATH']}", GH_TEST_ARGV=str(self.log))

  def run_task(self, *args):
    return subprocess.run([str(TASK), *args], env=self.env, capture_output=True, text=True, check=False)

  def test_default_dispatch_selects_main_and_hosted(self):
    result = self.run_task()
    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertEqual(json.loads(self.log.read_text()), [
      "workflow", "run", "ci.yml", "-R", "suzuryo/m-league-ical",
      "--ref", "main", "-f", "runner=github-hosted",
    ])

  def test_explicit_ref_is_one_argument(self):
    result = self.run_task("ci.yml", "feature/arc-runners")
    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertEqual(json.loads(self.log.read_text()), [
      "workflow", "run", "ci.yml", "-R", "suzuryo/m-league-ical",
      "--ref", "feature/arc-runners", "-f", "runner=github-hosted",
    ])

  def test_invalid_input_never_contacts_github(self):
    for args in [("",), ("docker.yaml",), ("dependency-review.yaml",), ("ci.yml", ""), ("ci.yml", "--repo=other/repo"), ("ci.yml", "two words"), ("ci.yml", "main", "extra")]:
      with self.subTest(args=args):
        result = self.run_task(*args)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.log.exists())

  def test_every_allowed_workflow_can_be_selected(self):
    for workflow in ["ci.yml", "github-pages.yml"]:
      with self.subTest(workflow=workflow):
        result = self.run_task(workflow, "release/v1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.log.read_text()), [
          "workflow", "run", workflow, "-R", "suzuryo/m-league-ical",
          "--ref", "release/v1", "-f", "runner=github-hosted",
        ])

  def test_help_does_not_dispatch(self):
    result = self.run_task("--help")
    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertIn("ci:github-hosted", result.stdout)
    self.assertFalse(self.log.exists())

  def test_github_failure_is_preserved(self):
    self.env["GH_TEST_EXIT"] = "17"
    self.assertEqual(self.run_task().returncode, 17)


if __name__ == "__main__":
  unittest.main()
