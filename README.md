# Seaweed

Библиотека для разбора и отображения PlantUML-диаграмм в браузере с использованием D3 и ELK.

## Что поддерживается

- объявления сущностей: `actor`, `participant`, `component`, `database`, `class`, `interface`, `enum`, `object`, `usecase`, bracket-нотация `[Component]`
- контейнеры и группы: `package`, `namespace`, `rectangle {}`, `node {}`, `frame {}`, `cloud {}`
- class-like тела: поля, методы и разделители внутри `{ ... }`, а также attached members вида `User : +name`
- связи с label, cardinality и direction: `->`, `-->`, `..>`, `o--`, `-right->` и похожие варианты
- activity subset: `start`, `:action;`, `if (...) then (...)`, `else (...)`, `endif`, `while (...)`, `endwhile (...)`, `stop`
- state subset: `state`, `[*] --> State`, `State --> State : event`, `State --> [*]`, state descriptions вида `State : text`
- sequence fragments: `group`, `alt`, `else`, `opt`, `loop`, `par`, `break`, `critical`, `box`, `ref`, `divider`
- notes: однострочные и многострочные `note ... : ...` / `note ...` + `end note`
- meta/directives: `title`, `caption`, `header`, `footer`, `left to right direction`, `skinparam`, `hide`, `show`, `autonumber`, `newpage`
- escaping/special cases: quoted labels with escaped quotes, `\n` in text metadata, colons inside quoted edge labels, line comments and `/' ... '/` block comments

## Установка

```bash
npm install
npm run build
```

## Использование в HTML

```html
<div id="diagram"></div>
<script src="./dist/seaweed.js"></script>
<script>
  const source = `@startuml
left to right direction
skinparam linetype ortho

package "Core" {
  abstract class "Auth Service" as Auth {
    +login(user, pass)
    --
    -token: string
  }

  interface SessionStore {
    +save(session)
  }
}

Auth ..> SessionStore : uses
note right of Auth
  external dependency
end note
@enduml`;

  const renderer = new window.Seaweed.PlantUMLRenderer(document.getElementById('diagram'), {
    theme: 'neutral',
    layoutAlgorithm: 'layered',
  });
  renderer.render(source);
</script>
```

## Темы

Готовые темы доступны как `default`, `neutral`, `forest`, `dark`.

```js
const renderer = new window.Seaweed.PlantUMLRenderer(container, {
  theme: 'dark',
});

renderer.setTheme('forest');
renderer.render(source);
```

Можно передать частичный override поверх темы по умолчанию:

```js
const renderer = new window.Seaweed.PlantUMLRenderer(container, {
  theme: {
    background: '#ffffff',
    nodeFill: '#f4fbff',
    nodeStroke: '#277da1',
    edgeStroke: '#1f2933',
  },
});
```

## Layout-алгоритмы

Поддерживаемые значения `layoutAlgorithm`: `layered`, `mrtree`, `stress`, `force`, `radial`, `disco`, `sporeOverlap`, `sporeCompaction`, `rectpacking`.

```js
const renderer = new window.Seaweed.PlantUMLRenderer(container, {
  layoutAlgorithm: 'mrtree',
});

renderer.setLayoutAlgorithm('stress');
renderer.render(source);
```

Для тонкой настройки ELK можно передать готовый preset с дополнительными `layoutOptions` или общий override:

```js
const renderer = new window.Seaweed.PlantUMLRenderer(container, {
  layoutAlgorithm: {
    name: 'layered',
    layoutOptions: {
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
  },
  layoutOptions: {
    'elk.edgeRouting': 'ORTHOGONAL',
  },
});
```

Для алгоритмов, которые не гарантируют routing стрелок или отсутствие пересечений, renderer включает post-layout нормализацию. Её можно настроить:

```js
const renderer = new window.Seaweed.PlantUMLRenderer(container, {
  layoutAlgorithm: 'force',
  preventNodeOverlap: true,
  rerouteEdges: 'auto',
  nodeOverlapGap: 28,
  parallelEdgeGap: 14,
});
```

## Программный разбор

```js
import { parsePlantUML } from './src/parser/parser.js';

const diagram = parsePlantUML(source);

console.log(diagram.nodes);
console.log(diagram.edges);
console.log(diagram.groups);
console.log(diagram.notes);
console.log(diagram.events);
console.log(diagram.meta);
console.log(diagram.warnings);
```

`warnings` содержит diagnostics совместимости с PlantUML. Неподдержанные строки не теряются молча:

```js
const diagram = parsePlantUML(source);
for (const warning of diagram.warnings) {
  console.warn(`${warning.lineNumber}: ${warning.message}`, warning.raw);
}
```

## Тесты

```bash
npm test
```
