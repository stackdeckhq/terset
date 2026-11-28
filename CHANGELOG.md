# Changelog

## 0.4.0

- JavaScript and Python now write format 1.2 by default. They use path entries such as `a/b: 1` only when the whole document saves at least 256 UTF-8 bytes over format 1.1.
- Both packages still read formats 1.0 and 1.1. Pass the format explicitly to write either older version.
- The site converter and offline counts use 1.2. Published model runs keep the format they used.
