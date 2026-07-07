# Архитектура Seaweed

## Цели

- расширять поддержку PlantUML без роста связности
- не смешивать лексический разбор, синтаксис, семантику и рендеринг
- сохранять максимум информации из исходника, а не сводить всё к `nodes/edges`

## Слои

```
src/
├── index.js
├── parser/
│   ├── lexer.js
│   ├── string-utils.js
│   ├── token-parsers.js
│   ├── parser-context.js
│   ├── line-handlers.js
│   └── parser.js
├── builder/
│   └── diagram-builder.js
└── renderer/
    ├── renderer.js
    ├── theme.js
    ├── utils/
    │   ├── geometry.js
    │   └── text.js
    ├── layout/
    │   ├── bounds.js
    │   ├── density.js
    │   ├── edges.js
    │   ├── elements.js
    │   ├── graph.js
    │   ├── node-shapes.js
    │   ├── postprocess.js
    │   └── sequence.js
    └── draw/
        ├── layers.js
        ├── node-shapes.js
        └── markers.js
```

## Parser Layer

### `lexer.js`
Отвечает только за токены строки.

- не знает про диаграмму
- не знает про builder
- возвращает токены с позициями `start/end`, чтобы синтаксические парсеры могли резать исходную строку без эвристик

### `string-utils.js`
Низкоуровневые string helpers.

- trim / normalize whitespace
- case-insensitive сравнения
- split по символам вне quoted-контекста
- sanitizing идентификаторов

### `token-parsers.js`
Слой синтаксических функций.

- `parseDeclarationLine()` разбирает объявления сущностей и контейнеров
- `parseEdge()` разбирает связи, cardinality и edge labels
- `parseNoteLine()` разбирает note descriptor
- `parseBlockLine()` разбирает sequence fragments
- `parseActivityLine()` разбирает базовый activity flow
- `parseStateTransition()` разбирает state transitions с `[*]`
- `parseAttachedMemberLine()` разбирает PlantUML-строки вида `Owner : member` для class/state descriptions
- `parseMemberLine()` разбирает поля/методы class-like тел
- `parseDirectiveLine()` и `parseMetadataLine()` сохраняют служебные инструкции

Важно: эти функции не меняют состояние диаграммы. Они только переводят строку в семантический DTO.

### `parser-context.js`
Контекст обхода исходника.

- текущий индекс строки
- доступ к builder
- нормализованное и raw представление statement
- предварительное удаление PlantUML block comments `/' ... '/` с сохранением line numbers

Контекст нужен, чтобы обработчики могли читать multi-line конструкции и при этом не знать ничего о внешнем цикле.

### `line-handlers.js`
Реестр statement handlers.

Каждый handler отвечает за один тип конструкции:

- ignore/comment/boundary
- metadata
- directives / skinparams
- closing scopes
- notes
- ref / divider / sequence blocks
- declarations
- classifier members
- events
- edges
- aliases

Расширение делается добавлением нового handler, а не переписыванием `parser.js`.

### `parser.js`
Только orchestration.

- создаёт `DiagramBuilder`
- создаёт `ParserContext`
- проходит по registry handlers
- возвращает итоговую модель

## Builder Layer

### `diagram-builder.js`
Единственная точка мутации модели диаграммы.

Builder отвечает за:

- deduplication узлов
- alias/reference resolution
- scopes для `{ ... }` и `end`
- groups / notes / events / edges / metadata
- diagnostics совместимости для неподдержанных или частично поддержанных PlantUML-конструкций
- flow/state helper methods для специализированных diagram modes
- сохранение richer-модели PlantUML

Именно здесь замыкается семантика: парсер не знает, как хранить сущности, а renderer не знает, как они были распознаны.

## Renderer Layer

### `renderer.js`
Фасад публичного renderer API.

- вызывает `parsePlantUML()`
- запускает ELK layout
- собирает layout-представления notes/groups/events
- создаёт SVG и вызывает draw layers

### `theme.js`
Единая точка визуальных констант.

- готовые Mermaid-like темы и custom overrides
- значения по умолчанию для renderer
- пресеты ELK layout-алгоритмов и их option overrides
- базовые размеры текста и отступов

### `utils/`
Низкоуровневая геометрия и работа с текстом.

- `geometry.js`: bounds, collision avoidance, label placement
- `text.js`: оценка ширины, строки узлов, размеры notes/events

### `layout/`
Подготовка данных для отрисовки.

- `graph.js`: модель диаграммы → ELK graph, выбранный ELK algorithm preset и пользовательские `layoutOptions`
- `node-shapes.js`: shape metadata для PlantUML-like типов, минимальные размеры и text insets
- `postprocess.js`: нормализует результат ELK, разводит пересекающиеся блоки и восстанавливает маршруты стрелок
- `sequence.js`: отдельная timeline-layout модель для sequence diagrams без ELK graph layout
- `density.js`: метрики плотности стрелок и адаптивные spacing/node sizes
- `edges.js`: точки/пути рёбер, markers, labels/cardinality layout
- `elements.js`: bounds контейнеров, fragments, notes, events
- `bounds.js`: общий `viewBox` и место под title

### `draw/`
D3-слой без бизнес-логики.

- `markers.js`: SVG markers для стрелок
- `node-shapes.js`: SVG-формы узлов: actor, usecase, component, cylinder, cloud, folder, file, artifact и др.
- `layers.js`: containers, fragments, edges, nodes, notes, events

## Модель диаграммы

`parsePlantUML()` возвращает:

```js
{
  nodes: [
    {
      id,
      label,
      type,
      alias?,
      parentId?,
      stereotypes?,
      modifiers?,
      members: []
    }
  ],
  edges: [
    {
      id,
      source,
      target,
      arrow,
      label?,
      sourceCardinality?,
      targetCardinality?,
      direction?,
      lineStyle?
    }
  ],
  groups: [
    {
      id,
      type,
      title,
      parentId?,
      branches?
    }
  ],
  notes: [
    {
      id,
      type,
      placement,
      body,
      targets: []
    }
  ],
  events: [
    {
      id,
      type,
      target?,
      body?
    }
  ],
  warnings: [
    {
      severity,
      code,
      message,
      lineNumber,
      raw
    }
  ],
  meta: {
    title,
    caption,
    header,
    footer,
    direction,
    skinparams,
    directives,
    hides,
    shows
  }
}
```

## Принципы расширения

### 1. Новый синтаксис строки
Добавляйте новую функцию в `token-parsers.js`, затем отдельный handler в `line-handlers.js`.

### 2. Новый stateful block
Используйте `ParserContext` для чтения нескольких строк и `DiagramBuilder` для открытия/закрытия scope.

### 3. Новая семантика модели
Добавляйте её в `DiagramBuilder`, а не размазывайте по handlers.

### 4. Новая визуализация
Меняйте модуль renderer по зоне ответственности.

- цвета и размеры: `renderer/theme.js`
- расположение и расчёты: `renderer/layout/` или `renderer/utils/geometry.js`
- SVG/D3 отрисовка: `renderer/draw/`
- orchestration/public API: `renderer/renderer.js`

## Почему это соответствует SOLID

- `S`: каждый модуль решает одну задачу
- `O`: новые конструкции добавляются новыми handler/parser units
- `L`: handlers взаимозаменяемы через единый контракт
- `I`: parser, builder и renderer не зависят от лишних интерфейсов
- `D`: оркестратор зависит от абстракции handler registry, а не от конкретных if-цепочек
