import { DiagramBuilder } from '../builder/diagram-builder.js';
import { createDefaultHandlers } from './line-handlers.js';
import { ParserContext } from './parser-context.js';

export function parsePlantUML(source) {
  const builder = new DiagramBuilder();
  const context = new ParserContext(source, builder);
  const handlers = createDefaultHandlers();

  while (context.hasMore()) {
    let handled = false;

    for (let index = 0; index < handlers.length; index += 1) {
      const handler = handlers[index];
      if (!handler.canHandle(context)) {
        continue;
      }

      handler.handle(context);
      handled = true;
      break;
    }

    if (!handled) {
      context.advance();
    }
  }

  return builder.build();
}
