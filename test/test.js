const assert = require("assert");
const { readdir, readFile, stat } = require("fs");
const { promisify } = require("util");
const { join, relative, resolve } = require("path");
const parseHTML = require("../src/parse-html").default;

const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
const statAsync = promisify(stat);

async function testAll(dir) {
  const paths = await readdirAsync(dir);
  const stats = await Promise.all(paths.map(path => statAsync(join(dir, path))));
  const tests = paths.filter((_, index) => stats[index].isDirectory());

  return Promise.all(tests.map(test => testOne(join(dir, test))));
}

async function testOne(dir) {
  const [input, expected] = await Promise.all([
    readFileAsync(resolve(dir, "./input.html")).then(content => content.toString("utf-8")),
    readFileAsync(resolve(dir, "./output.json")).then(content => JSON.parse(content.toString("utf-8")))
  ]);

  const result = parseHTML(input);

  try {
    assert.deepEqual(result, expected);
  } catch (ex) {
    throw new Error(`Assertion failed:\n\nExpected:\n${JSON.stringify(expected)}\n\nReceived:\n${JSON.stringify(result)}\n`);
  }

  return `√ ${relative(__dirname, dir)}`;
}

testAll(resolve(__dirname, "./fixture"))
  .then(suites => suites.join("\n"))
  .then(console.log.bind(console), console.error.bind(console));
