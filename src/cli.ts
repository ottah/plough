#!/usr/bin/env node
import colors from "colors";
import yargs from "yargs";
const yargv = yargs
  .commandDir("commands", { recurse: true })
  .demandCommand()
  .showHelpOnFail(true)
  .example("d", "plough download -p -s 0 1 -o ./artifact/assets")
  .alias("h", "help")
  .alias("v", "version")
  .version()
  .help()
  .argv;
