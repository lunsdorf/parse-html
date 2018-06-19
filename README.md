# parseHTML

A lightweight, string-based HTML parser for creating a simple AST.

```js
const ast = parseHTML(`
  <h1>Hello Parser!</h1>
  <p>How is your day going?</p>
`);

console.log(ast);

/*
[
  {type: "text", text: "\n  "},
  {type: "element", tagName: "h1", attributes: {}, childNodes: [
    {type: "text", text: "Hello Parser!"}
  ]},
  {type: "text", text: "\n  "},
  {type: "element", tagName: "p", attributes: {}, childNodes: [
    {type: "text", text: "How is your day going?"}
  ]},
  {type: "text", text: "\n"},
]
*/
```

## Motivation

Just for fun and curiosity.
