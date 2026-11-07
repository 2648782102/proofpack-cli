#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write("proofpack 0.1.0 (scaffold)\n");
} else {
  process.stdout.write("Proofpack is not implemented yet. See docs/PRODUCT.md.\n");
}
