import { ExampleItem } from "./L_Structs";
import { L_Env } from "./L_Env";
import { runStringsWithLogging } from "./L_Runner";
import * as fs from "fs";
import { log } from "console";

const exampleList: ExampleItem[] = [
  {
    name: "三段论",
    code: [
      "def something is mortal;",
      "def something is human; know if x: x is human  {x is mortal};",
      "let Socrates : Socrates is human;",
      "Socrates is  mortal;",
      "let god :  not mortal(god);",
      "not human(god);",
      "prove_by_contradiction  not  human(god) {god is mortal;}  god is mortal;",
      "not human(god);",
    ],
    debug: false,
    print: true,
  },
  {
    name: "def_commutative",
    code: ["def commutative p(x,y);", "let a,b: p(a,b); p(b,a);"],
    debug: false,
    print: true,
  },
  {
    name: "prove by contradiction",
    code: [
      "def_composite \\++{x}; def =(x,y);",
      "know if x,y: not x = y {not \\++{x} = \\++{y}};",
    ],
    debug: false,
    print: true,
  },
  {
    name: "literal opt",
    code: [
      `def_literal_operator arabic_plus {"./litex_lib/literal_operators.ts" , "arabic_plus"} a,b; `,
      `def =(1,2); let 1,2;`,
      "=(@arabic_plus{1,1} , 2);",
    ],
    debug: false,
    print: true,
  },
  {
    name: "exist, have",
    code: [
      "def p(x,y,z) ; let a,b ; know p(a,b, EXIST ); p(a,b, EXIST); have c: p(a,b,EXIST);",
    ],
    debug: false,
    print: true,
  },
  {
    name: "indexed symbol",
    code: [
      "def_composite \\frac{a,b}; let x,y ; def p(x); know p(x);",
      "p(at{\\frac{x,y},0}); ",
    ],
    debug: false,
    print: true,
  },
  {
    name: "1 + 1 =2",
    code: ["let 1,2; def_composite \\+{x,y}; def =(x,y); $ 1 + 1 = 2 $;"],
    debug: false,
    print: true,
  },
  {
    name: "1 + 1 =2",
    code: [
      `
{
  def_composite \\+{x,y}      ;
  let a,b;
  def $ =(x,y);
  \\+{a,b} + b = a;
  $=(a,b);
  know \\+{a,b} + b = a;
  \\+{a,b} + b = a;
}      
      `,
    ],
    debug: false,
    print: true,
  },
  {
    name: "$factual_opt",
    code: ["def $p(x); let y: $p(y);"],
    debug: false,
    print: true,
  },
  {
    name: "let_formal",
    code: ["let_formal x; def $p(x); $p(x); let_alias k x;"],
    debug: false,
    print: true,
  },
  {
    name: "",
    code: ["def_composite \\f{x}; let_formal x; def $p(x); $p(\\f{x});"],
    debug: false,
    print: true,
  },
  {
    name: "",
    code: [
      `
      def $set(a);
      def $equal(a,b);
      def $in(x,a);

know if a,b: $set(a), $set(b), $equal(a,b)  {
  if x: $in(x,a) {
    $in(x,b)
  }, 
  if x: $in(x,b) {
    $in(x,a)
  }
};
      
      `,
    ],
    debug: false,
    print: true,
  },
  {
    name: "",
    code: ["def $p(x); if x: $p(y) {};"],
    debug: true,
    print: true,
  },
];

function runExamples(toJSON: boolean) {
  const env = new L_Env();
  for (const example of exampleList) {
    if (example.debug) {
      console.log(example.name);
      runStringsWithLogging(env, example.code, example.print);
      if (example.test !== undefined) {
        runStringsWithLogging(env, example.test, example.print);
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
    const logging = true;
    runStringsWithLogging(env, [data], logging);
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
