import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlantUML } from '../src/parser/parser.js';

function findNode(diagram, id) {
  return diagram.nodes.find((node) => node.id === id);
}

function findGroup(diagram, type) {
  return diagram.groups.find((group) => group.type === type);
}

test('parsePlantUML keeps graph structure and container nesting', () => {
  const source = `@startuml
package "Users" {
  Alice as A
  Bob as B
  A --> B
}
@enduml`;

  const diagram = parsePlantUML(source);
  const packageGroup = findGroup(diagram, 'package');
  const alice = findNode(diagram, 'A');
  const bob = findNode(diagram, 'B');

  assert.equal(diagram.nodes.length, 2);
  assert.equal(diagram.edges.length, 1);
  assert.equal(diagram.groups.length, 1);
  assert.equal(packageGroup.title, 'Users');
  assert.equal(alice.label, 'Alice');
  assert.equal(alice.parentId, packageGroup.id);
  assert.equal(bob.label, 'Bob');
  assert.deepEqual(diagram.edges[0], {
    id: 'A-B',
    source: 'A',
    target: 'B',
    arrow: '-->',
    lineStyle: 'solid',
  });
});

test('parsePlantUML supports common declarations, aliases and arrow metadata', () => {
  const source = `@startuml
actor User
participant "Auth Service" as Auth
[Gateway] as API
User -right-> Auth
Auth --> API : authorize
@enduml`;

  const diagram = parsePlantUML(source);
  const user = findNode(diagram, 'User');
  const auth = findNode(diagram, 'Auth');
  const gateway = findNode(diagram, 'API');

  assert.equal(user.type, 'actor');
  assert.equal(auth.label, 'Auth Service');
  assert.equal(auth.alias, 'Auth');
  assert.equal(gateway.type, 'component');
  assert.equal(diagram.edges[0].direction, 'right');
  assert.equal(diagram.edges[1].label, 'authorize');
});

test('parsePlantUML parses classifiers, members and directives without losing semantics', () => {
  const source = `@startuml
left to right direction
skinparam linetype ortho
hide empty members
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
@enduml`;

  const diagram = parsePlantUML(source);
  const auth = findNode(diagram, 'Auth');
  const sessionStore = findNode(diagram, 'SessionStore');
  const dependency = diagram.edges[0];

  assert.equal(diagram.meta.direction, 'left to right');
  assert.equal(diagram.meta.skinparams.linetype, 'ortho');
  assert.deepEqual(diagram.meta.hides, ['empty members']);
  assert.equal(auth.type, 'class');
  assert.deepEqual(auth.modifiers, ['abstract']);
  assert.equal(auth.members.length, 3);
  assert.equal(auth.members[0].kind, 'method');
  assert.equal(auth.members[1].kind, 'separator');
  assert.equal(auth.members[2].kind, 'field');
  assert.equal(sessionStore.type, 'interface');
  assert.equal(sessionStore.members[0].text, 'save(session)');
  assert.equal(dependency.arrow, '..>');
  assert.equal(dependency.lineStyle, 'dashed');
  assert.equal(dependency.label, 'uses');
});

test('parsePlantUML supports sequence fragments, multiline notes and events', () => {
  const source = `@startuml
participant Alice
participant Bob
alt success
Alice -> Bob : login
else failure
note right of Bob
  waiting for retry
  with timeout
end note
end
activate Bob
deactivate Bob
@enduml`;

  const diagram = parsePlantUML(source);
  const fragment = findGroup(diagram, 'alt');

  assert.equal(fragment.title, 'success');
  assert.equal(fragment.branches.length, 1);
  assert.equal(fragment.branches[0].label, 'failure');
  assert.equal(diagram.notes.length, 1);
  assert.equal(diagram.notes[0].placement, 'right of');
  assert.equal(diagram.notes[0].body, 'waiting for retry\nwith timeout');
  assert.deepEqual(
    diagram.events.map((event) => event.type),
    ['activate', 'deactivate'],
  );
  assert.deepEqual(
    diagram.timeline.map((item) => item.type),
    ['group-open', 'edge', 'group-branch', 'note', 'group-close', 'event', 'event'],
  );
});

test('parsePlantUML supports cardinalities, reference blocks and divider markers', () => {
  const source = `@startuml
[Payment Service] as Payment
Order "1" o-- "*" Payment : contains
ref over Payment : external system
== Sync ==
@enduml`;

  const diagram = parsePlantUML(source);
  const payment = findNode(diagram, 'Payment');
  const relation = diagram.edges[0];
  const divider = findGroup(diagram, 'divider');
  const refGroup = findGroup(diagram, 'ref');

  assert.equal(payment.label, 'Payment Service');
  assert.equal(payment.type, 'component');
  assert.equal(relation.sourceCardinality, '1');
  assert.equal(relation.targetCardinality, '*');
  assert.equal(relation.arrow, 'o--');
  assert.equal(relation.label, 'contains');
  assert.equal(refGroup.title, 'external system');
  assert.equal(diagram.notes[0].type, 'ref');
  assert.equal(divider.title, 'Sync');
});

test('parsePlantUML handles escaping, quoted delimiters and block comments', () => {
  const source = `@startuml
title First\\nSecond
participant "Auth \\"Service\\"" as Auth
Alice -> Bob : "value: still one label"
Bob -> Alice : visible /' inline comment '/
/'
this should not produce warnings
Bob -> Alice : ignored
'/
class "Quoted \\"User\\"" as User
User : +displayName: string
@enduml`;

  const diagram = parsePlantUML(source);
  const auth = findNode(diagram, 'Auth');
  const user = findNode(diagram, 'User');

  assert.equal(diagram.meta.title, 'First\nSecond');
  assert.equal(auth.label, 'Auth "Service"');
  assert.equal(user.label, 'Quoted "User"');
  assert.equal(user.members[0].text, 'displayName: string');
  assert.equal(diagram.edges.length, 2);
  assert.equal(diagram.edges[0].label, 'value: still one label');
  assert.equal(diagram.edges[1].label, 'visible');
  assert.deepEqual(diagram.warnings, []);
});

test('parsePlantUML supports basic activity flow syntax', () => {
  const source = `@startuml
start
:Receive request;
if (valid?) then (yes)
  :Approve;
else (no)
  :Reject;
endif
stop
@enduml`;

  const diagram = parsePlantUML(source);
  const decision = diagram.nodes.find((node) => node.type === 'activityDecision');
  const approve = diagram.nodes.find((node) => node.label === 'Approve');
  const reject = diagram.nodes.find((node) => node.label === 'Reject');

  assert.equal(diagram.meta.diagramType, 'activity');
  assert.ok(findNode(diagram, 'activity-start'));
  assert.ok(findNode(diagram, 'activity-end'));
  assert.equal(decision.label, 'valid?');
  assert.equal(approve.type, 'activityAction');
  assert.equal(reject.type, 'activityAction');
  assert.ok(diagram.edges.some((edge) => edge.source === decision.id && edge.target === approve.id && edge.label === 'yes'));
  assert.ok(diagram.edges.some((edge) => edge.source === decision.id && edge.target === reject.id && edge.label === 'no'));
});

test('parsePlantUML supports basic state machine syntax', () => {
  const source = `@startuml
[*] --> Idle
Idle --> Running : start
Running --> [*] : done
@enduml`;

  const diagram = parsePlantUML(source);
  const idle = findNode(diagram, 'Idle');
  const running = findNode(diagram, 'Running');

  assert.equal(diagram.meta.diagramType, 'state');
  assert.equal(findNode(diagram, 'state-start').type, 'stateStart');
  assert.equal(findNode(diagram, 'state-end').type, 'stateEnd');
  assert.equal(idle.type, 'state');
  assert.equal(running.type, 'state');
  assert.ok(diagram.edges.some((edge) => edge.source === 'state-start' && edge.target === 'Idle'));
  assert.ok(diagram.edges.some((edge) => edge.source === 'Running' && edge.target === 'state-end' && edge.label === 'done'));
});

test('parsePlantUML supports attached class and state members', () => {
  const source = `@startuml
class User
User : +name: string
User : +login()
state Idle
Idle : waits for request
@enduml`;

  const diagram = parsePlantUML(source);
  const user = findNode(diagram, 'User');
  const idle = findNode(diagram, 'Idle');

  assert.equal(user.members.length, 2);
  assert.deepEqual(user.members[0], {
    kind: 'field',
    text: 'name: string',
    visibility: '+',
  });
  assert.deepEqual(user.members[1], {
    kind: 'method',
    text: 'login()',
    visibility: '+',
  });
  assert.equal(idle.members[0].text, 'waits for request');
  assert.deepEqual(diagram.warnings, []);
});

test('parsePlantUML supports simple activity while loops', () => {
  const source = `@startuml
start
while (data available?) is (yes)
:Read data;
endwhile (no)
stop
@enduml`;

  const diagram = parsePlantUML(source);
  const loop = diagram.nodes.find((node) => node.type === 'activityDecision');
  const action = diagram.nodes.find((node) => node.label === 'Read data');

  assert.equal(diagram.meta.diagramType, 'activity');
  assert.equal(loop.label, 'data available?');
  assert.ok(diagram.edges.some((edge) => edge.source === loop.id && edge.target === action.id && edge.label === 'yes'));
  assert.ok(diagram.edges.some((edge) => edge.source === action.id && edge.target === loop.id));
  assert.ok(diagram.edges.some((edge) => edge.source === loop.id && edge.target === 'activity-end' && edge.label === 'no'));
  assert.deepEqual(diagram.warnings, []);
});

test('parsePlantUML reports compatibility warnings for unsupported PlantUML syntax', () => {
  const source = `@startuml
create Bob
Alice -> Bob : hello
return ok
class User
User : +name: string
repeat
@enduml`;

  const diagram = parsePlantUML(source);

  assert.deepEqual(
    diagram.warnings.map((warning) => warning.code),
    ['partial-support', 'partial-support', 'unsupported-line'],
  );
  assert.deepEqual(
    diagram.warnings.map((warning) => warning.lineNumber),
    [2, 4, 7],
  );
  assert.equal(findNode(diagram, 'User').members[0].text, 'name: string');
  assert.equal(diagram.warnings[0].raw, 'create Bob');
  assert.equal(diagram.warnings[2].raw, 'repeat');
});
