// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { MessageSubject } from "./MessageSubject";
import { MessageBodyMarkdown } from "./MessageBodyMarkdown";

/**
 * 
 */

import * as t from "io-ts";

// required attributes
const MessageContentR = t.interface({
  markdown: MessageBodyMarkdown
});

// optional attributes
const MessageContentO = t.partial({
  subject: MessageSubject
});

export const MessageContent = t.intersection(
  [MessageContentR, MessageContentO],
  "MessageContent"
);

export type MessageContent = t.TypeOf<typeof MessageContent>;
