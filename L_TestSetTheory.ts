import { ExampleItem } from "./L_Structs";
import { L_Env } from "./L_Env";
import { runStrings } from "./L_Runner";
import * as fs from "fs";

const exampleList: ExampleItem[] = [
  {
    name: "define subset",
    code: [
      `
def object(x);
def set(x);
know if x: set(x) {
  object(x)
};

// In this file, code embrace by {} are executed in a local environment and 
// reader might read them as if it is 'test-code' for what has be declared.
{
  let a: set(a);
  object(a);
}

/* Definition 3.1.4 (Equality of sets). Two sets A and B are equal, A = B, iff 
every element of A is an element of B and vice versa. To put it another way,
A = B if and only if every element x of A belongs also to B, and every element 
y of B belongs also to A. */

def equal(a,b);
def in(x,a);
know if a,b: set(a), set(b), equal(a,b)  {
  if x: in(x,a) {
    in(x,b)
  }, 
  if x: in(x,b) {
    in(x,a)
  }
};

know if a,b: set(a), set(b), if x: in(x,a) {in(x,b)}, if x: in(x,b) {in(x,a)} {
  equal(a,b)
};

{
  let a, b: set(a), set(b), equal(a,b); 
  know if x: in(x,a)  {
    in(x,b)
  };
  know if x: in(x,b)  {
    in(x,a)
  }; 
  let x: in(x,a); 
  in(x,b); 
}

/* 
\textbf{Axiom 3.2 (Empty set).}  
There exists a set $\emptyset$, known as the \textit{empty set}, such that:
\[
\forall x \, (x \notin \emptyset),
\]
i.e., it contains no elements. 
*/

let EMPTY_SET: set(EMPTY_SET);
know if x {
    not in(x,EMPTY_SET),
};

{
    let x : not in(x, EMPTY_SET);
    if _x {
        not in(_x,EMPTY_SET)[_x];
    };
}

/*
Axiom 3.3 (Singleton sets and pair sets). If a is an object, then there exists a
set {a} whose only element is a, i.e., for every object y, we have y∈{a} if and 
only if y = a; we refer to {a} as the singleton set whose element is a. 
Furthermore, if a and b are objects, then there exists a set {a, b} whose only 
elements are a and b; i.e., for every object y, we have y ∈ {a, b} if and only 
if y = a or y = b; we refer to this set as the pair set formed by a and b.
*/

def_composite \\singleton{a};
know if x, a: in(x, \\singleton{a}) {
    equal(x, a);
};

know if x, a: equal(x,a) {
    in(x, \\singleton{a});
};

{
    let a, b;
    know set(\\singleton{a});
    let x;
    know in(x, \\singleton{a});
    equal(x,a);
    in(x, \\singleton{a});
    if _x, _a: equal(_x,_a) {
        in(_x, \\singleton{_a})[_x, _a];
    };
}

know if x, a, b: in(x, \\pair{a,b}) {
    if : not equal(x, b) {
        equal(x, a);
    };
    if : not equal(x, a) {
        equal(x, b);
    };
};

know if x, a, b: equal(x,a) {
    in(x, \\pair{a,b});
};

know if x, a, b: equal(x,b) {
    in(x, \\pair{a,b});
};

{
    let x, a, b: equal(x,a);
    in(x, \\pair{a,b})[x,a,b];
    let y,c,d: in(y, \\pair{c,d}), not equal(y,c);
    equal(y,d)[y,c,d;];
}


 
/*
Axiom 3.4 (Pairwise union). Given any two sets \(A\), \(B\), there exists a set 
\(A \cup B\), called the union \(A \cup B\) of \(A\) and \(B\), whose elements
consist of all the elements which belong to \(A\) or \(B\) or both. In other
words, for any object \(x\), 
\[
x \in A \cup B \iff (x \in A \lor x \in B).
\]
*/

def_composite \\union{x,y};
know if x, y: set(x), set(y) {
    if z: in(z, x) {
        in(z, \\union{x, y});
    };
    if z: in(z, y) {
        in(z, \\union{x,y});
    };
};

know if x, y, z: in(z, \\union{x, y}) {
    if : not in(z, x) {
        in(z, y);
    };
    if : not in(z, y) {
        in(z, x);
    };
};

{
    let a,b: set(a), set(b);
    let x: in(x,a);
    in(x, \\union{a,b})[a,b; x];
    in(x, \\union{a,b});
    let y, c, d: in(y, \\union{c,d});
    know not in(y, c);
    in(y, d)[c,d,y;];
}


/*
Axiom 3.4 (Pairwise union). Given any two sets \(A\), \(B\), there exists a set 
\(A \cup B\), called the union \(A \cup B\) of \(A\) and \(B\), whose elements
consist of all the elements which belong to \(A\) or \(B\) or both. In other
words, for any object \(x\), 
\[
x \in A \cup B \iff (x \in A \lor x \in B).
\]
*/

def subset(x,y);

know if A,B: subset(A,B) {
    if x: in(x,A) {
        in(x,B);
    };
};

know if A,B: if x: in(x,A) {
    in(x,B);
} {
    subset(A,B);
};

{
    let A,B,C,D,E,F;
    know subset(A,B);
    let x: in(x,A);
    in(x,B);
    in(x,B)[A,B;x];
    in(x,B);
}

/*
Axiom 3.5 (Axiom of specification). Let \(A\) be a set, and for each 
\(x \in A\), let \(P(x)\) be a property pertaining to \(x\) (i.e., \(P(x)\) is 
either a true statement or a false statement). Then there exists a set, called
\(\{x \in A : P(x) \text{ is true}\}\) (or simply \(\{x \in A : P(x)\}\) for 
short), whose elements are precisely the elements \(x\) in \(A\) for which 
\(P(x)\) is true. In other words, for any object \(y\),
\[
y \in \{x \in A : P(x) \text{ is true}\} \iff (y \in A \text{ and } P(y) \text{ is true}).
\]
*/

def_composite \\subset_with_property{A,P}: set(A), is_property(P);

know if A, P: is_property(P), set(A) {
    subset(\\subset_with_property{A,P}, A);
};

{
    def p(x);
    is_property(p);
    let x: set(x);
    subset(\\subset_with_property{x,p}, x)[x,p];
}

/*
Definition 3.1.23 (Intersections). The intersection \(S_1 \cap S_2\) of two sets
is defined to be the set
\[
S_1 \cap S_2 := \{x \in S_1 : x \in S_2\}.
\]
In other words, \(S_1 \cap S_2\) consists of all the elements which belong to
both \(S_1\) and \(S_2\). Thus, for all objects \(x\),
\[
x \in S_1 \cap S_2 \iff x \in S_1 \text{ and } x \in S_2.
\]
*/

def_composite \\intersection{a,b}; 
know if x, a, b: a is set, b is set, in(x,a), in(x,b) {
    in(x, \\intersection{a,b});
};

know if x, a, b: set(a), set(b), in(x, \\intersection{a,b}) {
    in(x,a);
    in(x, b);
};

{
    let A, B: set(A), set(B);
    let x;
    know in(x,A), in(x,B);
    in(x, \\intersection{A,B})[x,A,B];
    if X: in(X,A), in(X,B) {
        in(X, \\intersection{A,B})[X,A,B];
    };
    if X: in(X, \\intersection{A,B}) {
        in(X,A)[X,A,B];
        in(X, B)[X,A,B];
    };
}

/*
Definition 3.1.27 (Difference sets). Given two sets \(A\) and \(B\), we define 
the set \(A - B\) or \(A \\setminus B\) to be the set \(A\) with any elements of
\(B\) removed:
\[
A \\setminus B := \{x \in A : x \notin B\}.
\]
*/

def_composite \\difference{a,b}: set(a), set(b);

know if x, a, b: set(a), set(b), in(x,a), not in(x,b) {
    in(x, \\difference{a,b});
};

def_composite \\replacement{a,p}: set(a), is_property(p), if x, a: set(a), in(x,a) {
    if y1, y2: p(x, y1), p(x, y2) {
        equal(y1, y2);
    };
};

/*
Axiom 3.6 (Replacement). Let \(A\) be a set. For any object \(x \in A\), and any
object \(y\), suppose we have a statement \(P(x, y)\) pertaining to \(x\) and 
\(y\), such that for each \(x \in A\) there is at most one \(y\) for which 
\(P(x, y)\) is true. Then there exists a set \(\{y : P(x, y) \text{ is true for
some } x \in A\}\), such that for any object \(z\),
\[
z \in \{y : P(x, y) \text{ is true for some } x \in A\} \iff P(x, z) \text{ is 
true for some } x \in A.
\]
*/

def_composite \\replacement_var{z,a,p} ;

know if z, a, p: set(a), is_property(p), if x, a: set(a), in(x,a) {
    if y1, y2: p(x, y1), p(x, y2) {
        equal(y1, y2);
    };
    in(z, \\replacement{a,p});
} {
    p(\\replacement_var{z,a,p}, z);
};

def disjoint(a,b);
know if a,b : a is set, b is set, if x: in(x, a)  {not in(x, b)}, if x : in(x,b)
{not in(x, a)} {disjoint(a,b)};

/*
Axiom 3.9 (Regularity). If A is a non-empty set, then there is at least one 
element x of A which is either not a set, or is disjoint from A.
*/

def_composite \\regularity_element{A} : set(A), not equal(A, EMPTY_SET);

know if A: set(A), not equal(A, EMPTY_SET) {
  if : not set(\\regularity_element{A}) {
    disjoint(A, \\regularity_element{A})
  },
  if : not disjoint(A, \\regularity_element{A} ) {
    set(\\regularity_element{A})
  }
};

def natural(x);
def nat_eq(x,y);

let 0: 0 is natural;

def_composite \\++{n}: n is natural;

know if n: n is natural {
    \\++{n} is natural;
};

know if x {
    not nat_eq(0, \\++{x});
};

know if x,y: nat_eq(x,y) {
    nat_eq(\\++{x}, \\++{y});
};

know if x,y: nat_eq(\\++{x}, \\++{y}) {
    nat_eq(x,y);
};

know if P: is_property(P), P(0), if n: n is natural, P(n) {
    P(\\++{n});
} {
    if m: m is natural {
        P(m);
    }
};

def_composite \\+{x,y};

`,
    ],
    debug: true,
    print: true,
  },
];

function runExamples(toJSON: boolean) {
  const env = new L_Env();
  for (const example of exampleList) {
    if (example.debug) {
      console.log(example.name);
      runStrings(env, example.code, example.print);
      if (example.test !== undefined) {
        runStrings(env, example.test, example.print);
      }
    }
  }
  if (toJSON) envToJSON(env, "env.json");
}

export function envToJSON(env: L_Env, fileName: string) {
  const out = env.toJSON();
  const jsonString = JSON.stringify(out, null, 2);

  fs.writeFileSync(fileName, jsonString, "utf8");

  return out;
}

function runLiTeXFile(filePath: string) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const env = new L_Env();
    runStrings(env, [data], true);
  } catch (err) {
    console.error("Error:", err);
  }
}

function run() {
  const args = process.argv.slice(2);
  if (!args || args.length === 0) {
    runExamples(false);
  } else {
    runLiTeXFile(args[0]);
  }
}

run();
