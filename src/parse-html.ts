/*!
 * Parser State Transitions
 *
 * Superfluous  > Comment | Text | ElementOpen | ElementClose
 * Comment      > Superfluous
 * Text         > Superfluous
 * ElementOpen  > Superfluous
 * ElementClose > Superfluous
 */

interface Cursor {
  input: string;
  length: number;
  offset: number;
}

export interface HTMLTextNode {
  type: HTMLNodeType.Text | HTMLNodeType.Comment;
  text: string;
}

export interface HTMLFragmentNode {
  childNodes: HTMLNode[];
}

export interface HTMLElementNode extends HTMLFragmentNode {
  attributes: HTMLElementNodeAttributes;
  tagName: string;
  type: HTMLNodeType.Element;
}

export type HTMLElementNodeAttributes = {
  [name: string]: boolean | string;
};

export type HTMLNode = HTMLTextNode | HTMLFragmentNode | HTMLElementNode;

export enum HTMLNodeType {
  Element = "element",
  Text = "text",
  Comment = "comment",
}

/**
 * @private
 * Reads and returns the given number of chars, starting at the current offset
 * position. If the remaining number of chars are less than the requested, all
 * remaining chars are returned.
 * @param cursor Parser cursor
 * @param amount The number of chars to read
 * @param updateOffset Flag to define wether or not the cursor position should
 * be updated.
 */
function readChars(cursor: Cursor, amount: number, updateOffset: boolean): string {
  const { input, length, offset } = cursor;
  const maxAmount = offset + amount > length
    ? length - offset
    : amount;

  if (updateOffset) {
    cursor.offset = offset + maxAmount;
  }

  if (1 > maxAmount) {
    return "";
  }

  return input.substr(offset, maxAmount);
}

/**
 * @private
 * Reads and returns all chars until the given sequence was found, starting from
 * the current offset position. If the sequence is never found, it will return
 * the remaining string. The sequence itself will never be included in the
 * returned result, even if `updateIncludeSequence` is set to `true`.
 * @param cursor Parser cursor
 * @param sequence A string up to which is read.
 * @param updateOffset Flag to define wether or not the cursor position should
 * be updated.
 * @param updateIncludeSequence Flag to define wether or not the length of the
 * given sequence should be added to the cursor position. This flag is ignored
 * if `updateOffset` is set to `false`.
 */
function readCharsUntil(
  cursor: Cursor,
  sequence: string,
  updateOffset: boolean,
  updateIncludeSequence: boolean
): string {
  const char = sequence.charAt(0);
  const sequenceLength = sequence.length;
  const { input, length, offset } = cursor;
  let result = "";

  for (let i = offset; i < length; i++) {
    const c = input.charAt(i);

    if (c === char && (1 === sequenceLength || sequence === input.substr(i, sequenceLength))) {
      if (updateOffset) {
        cursor.offset = updateIncludeSequence
          ? i + sequenceLength
          : i;
      }

      return result;
    }

    result = result + c;
  }

  if (updateOffset) {
    cursor.offset = length;
  }

  return result;
}

/**
 * @private
 * Reads and returns the `tagName` from an opening HTML element.
 * @param cursor Parser cursor
 */
function readTagName(cursor: Cursor): string {
  const { input, length, offset } = cursor;
  let tagName = "";

  for (let i = offset; i < length; i++) {
    const c = input.charAt(i);

    switch (c) {
      case " ":
      case "/":
      case ">":
        cursor.offset = i;
        return tagName;
      default:
        tagName = tagName + c;
        break;
    }
  }

  cursor.offset = cursor.length;

  return tagName;
}

/**
 * @private
 * Reads and returns the attributes from an opening HTML element.
 * @param cursor Parser cursor
 */
function readAttributes(cursor: Cursor): HTMLElementNodeAttributes {
  const { input, length, offset } = cursor;
  const attributes = {} as HTMLElementNodeAttributes;
  let currentName = "";
  let currentValue = "";
  let parsingName = false;
  let parsingValue = false;
  let parsingQuotes = "";

  for (let i = offset; i < length; i++) {
    const c = input.charAt(i);

    switch (c) {
      case "/":
      case ">":
        if (!parsingValue) {
          appendAttribute(attributes, currentName, currentValue);
          cursor.offset = i;

          return attributes;
        }

        currentValue = currentValue + c;
        break;
      case " ":
        if (parsingValue && "" !== parsingQuotes) {
          currentValue = currentValue + c;
          break;
        }

        appendAttribute(attributes, currentName, currentValue);
        currentName = "";
        currentValue = "";
        parsingQuotes = "";
        parsingName = true;
        parsingValue = false;

        break;
      case "=":
        if (parsingValue) {
          currentValue = currentValue + c;
          break;
        }

        parsingName = false;
        parsingValue = !parsingValue;
        parsingQuotes = input.charAt(i + 1);

        if ("\"" === parsingQuotes || "'" === parsingQuotes) {
          i = i + 1;
        } else {
          parsingQuotes = "";
        }
        break;
      case parsingQuotes:
        parsingName = false;
        parsingValue = !parsingValue;
        break;
      default:
        if (parsingName) {
          currentName = currentName + c;
        } else {
          currentValue = currentValue + c;
        }
        break;
    }
  }

  cursor.offset = cursor.length;

  return attributes;
}

/**
 * @private
 * Appends an attribute to the given attributes object. The value will be set
 * to `true` if the given value is an empty string.
 * @param attributes Object to append the attribute to
 * @param name The attribute name
 * @param value The attribute value
 */
function appendAttribute(attributes: HTMLElementNodeAttributes, name: string, value: string): void {
  if (0 < name.length) {
    attributes[name] = 0 < value.length
      ? value
      : true;
  }
}

/**
 * @private
 * Appends a child node to the latest parent element.
 * @param parents Hierarchical array of parent elements
 * @param childNode Child node to add
 */
function appendChildNode(parents: HTMLFragmentNode[], childNode: HTMLNode): void {
  parents[parents.length - 1].childNodes.push(childNode);
}

/**
 * @private
 * Checks if the given `tagName` represents a self-closing HTML element.
 * @param tagName The element's `tagName`
 */
function isSelfClosingElement(tagName: string): boolean {
  switch (tagName) {
    case "area":
    case "base":
    case "br":
    case "col":
    case "command":
    case "embed":
    case "hr":
    case "img":
    case "input":
    case "keygen":
    case "link":
    case "menuitem":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
      return true;
    default:
      return false;
  }
}

/**
 * @private
 * Parser state function that decides what the next node will be after the
 * previous one was done parsing.
 * @param cursor Parser cursor
 * @param parents Hierarchical array of parent elements
 */
function superfluous(cursor: Cursor, parents: HTMLFragmentNode[]): void {
  switch (readChars(cursor, 1, false)) {
    case "":
      return;
    case "<":
      if ("</" === readChars(cursor, 2, false)) {
        cursor.offset = cursor.offset + 2;
        return elementClose(cursor, parents);
      }
      if ("<!--" === readChars(cursor, 4, false)) {
        cursor.offset = cursor.offset + 4;
        return comment(cursor, parents);
      }

      cursor.offset = cursor.offset + 1;
      return elementOpen(cursor, parents);
    default:
      return text(cursor, parents);
  }
}

/**
 * @private
 * Parser state function for parsing text nodes.
 * @param cursor Parser cursor
 * @param parents Hierarchical array of parent elements
 */
function text(cursor: Cursor, parents: HTMLFragmentNode[]): void {
  const node: HTMLTextNode = {
    type: HTMLNodeType.Text,
    text: readCharsUntil(cursor, "<", true, false),
  };

  appendChildNode(parents, node);

  superfluous(cursor, parents);
}

/**
 * @private
 * Parser state function for parsing comment nodes.
 * @param cursor Parser cursor
 * @param parents Hierarchical array of parent elements
 */
function comment(cursor: Cursor, parents: HTMLFragmentNode[]): void {
  const node: HTMLTextNode = {
    type: HTMLNodeType.Comment,
    text: readCharsUntil(cursor, "-->", true, true),
  };

  appendChildNode(parents, node);

  superfluous(cursor, parents);
}

/**
 * @private
 * Parser state function for opening HTML element nodes.
 * @param cursor Parser cursor
 * @param parents Hierarchical array of parent elements
 */
function elementOpen(cursor: Cursor, parents: HTMLFragmentNode[]): void {
  const tagName = readTagName(cursor);
  const attributes = readAttributes(cursor);

  const node: HTMLElementNode = {
    type: HTMLNodeType.Element,
    tagName,
    attributes,
    childNodes: [],
  };

  appendChildNode(parents, node);

  const end = readCharsUntil(cursor, ">", true, true);

  // Only push to parents if the current tag is not self closing.
  if ("/" !== end.charAt(end.length - 1) &&  !isSelfClosingElement(tagName)) {
    parents.push(node);
  }

  // Read complete content for special tags.
  if ("script" === tagName || "textarea" === tagName) {
    const content = readCharsUntil(cursor, "</" + tagName, true, false);

    if (0 < content.length) {
      appendChildNode(parents, {
        type: HTMLNodeType.Text,
        text: content,
      });
    }
  }

  superfluous(cursor, parents);
}

/**
 * @private
 * Parser state function for closing HTML element nodes.
 * @param cursor Parser cursor
 * @param parents Hierarchical array of parent elements
 */
function elementClose(cursor: Cursor, parents: HTMLFragmentNode[]): void {
  readCharsUntil(cursor, ">", true, true);

  superfluous(cursor, parents.slice(0, parents.length - 1));
}

/**
 * Parses an HTML string to an AST representation.
 * @param html HTML string to parse
 */
export default function parseHTML(html: string): HTMLNode[] {
  const fragment: HTMLFragmentNode = { childNodes: [] };
  const cursor = {
    input: html,
    length: html.length,
    offset: 0,
  };

  // Skip doctype definition.
  if ("<!" === readChars(cursor, 2, false)) {
    cursor.offset = Math.min(9, cursor.length); // length of `<!DOCTYPE`

    readCharsUntil(cursor, "<", true, false);
  }

  superfluous(cursor, [fragment]);

  return fragment.childNodes;
}
