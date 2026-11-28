# Changelog

## 0.4.0

- JavaScript and Python now write format 1.2 by default. A path entry such as `a/b: 1` can replace a nested object when it takes fewer bytes.
- Both packages still read formats 1.0 and 1.1. Pass the format explicitly to write either older version.
- The site converter and offline counts use 1.2. Published model runs keep the format they used.
