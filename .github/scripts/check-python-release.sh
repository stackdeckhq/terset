#!/usr/bin/env bash
set -euo pipefail

# Build a copy so setuptools never leaves build or egg-info in the checkout.
root="${GITHUB_WORKSPACE:?}"
work="${RUNNER_TEMP:?}/terset-python"
mkdir -p "$work"
python -B -m unittest discover -s "$root/packages/terset-py/tests" -v
python -m pip install --disable-pip-version-check build==1.3.0 twine==6.2.0
cp -R "$root/packages/terset-py" "$work/source"
python -B -m build --outdir "$work/dist" "$work/source"
python -B -m twine check --strict "$work"/dist/*
python -B -m venv "$work/venv"
"$work/venv/bin/python" -B -m pip install --no-index --no-deps "$work"/dist/*.whl
cd "$work"
"$work/venv/bin/python" -I -B "$root/.github/scripts/smoke-python.py"
