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
  const [input, output] = await Promise.all([
    readFileAsync(resolve(dir, "./input.html")).then(content => content.toString("utf-8")),
    readFileAsync(resolve(dir, "./output.json")).then(content => JSON.parse(content.toString("utf-8")))
  ]);

  assert.deepEqual(parseHTML(input), output);

  return `√ ${relative(__dirname, dir)}`;
}

Promise.all([
  testAll(resolve(__dirname, "./fixture/basic")),
  testAll(resolve(__dirname, "./fixture/data-attributes"))
])
.then(suites => suites.map(suite => suite.join("\n")).join("\n\n"))
.then(console.log.bind(console), console.error.bind(console));
