/** The kinds of animals the shelter tracks. */
export type AnimalKind = 'dog' | 'cat';

/** Something that can make noise and be identified. */
export interface Animal {
  readonly name: string;
  kind: AnimalKind;
  speak(): string;
}

/** A dog. Implements the Animal contract. */
export class Dog implements Animal {
  readonly name: string;
  kind: AnimalKind = 'dog';

  constructor(name: string) {
    this.name = name;
  }

  speak(): string {
    return `${this.name} says woof`;
  }
}

// Undocumented on purpose: doc-coverage layer target.
export class Puppy extends Dog {
  speak(): string {
    return super.speak() + '!';
  }
}
