import { L_Env } from "./L_Env.ts";
import { RType } from "./L_Executor.ts";
import * as L_Executor from "./L_Executor.ts";
import { L_Scan } from "./L_Lexer.ts";
import * as L_Parser from "./L_Parser.ts";

export function runString(
  env: L_Env,
  expr: string,
  print: boolean = true,
  printCode: boolean = true
) {
  try {
    if (print && printCode)
      console.log(`-----\n***  source code  ***\n${expr}\n`);
    const tokens = L_Scan(expr);
    const nodes = L_Parser.parseUntilGivenEnd(env, tokens, null);
    if (nodes === undefined) {
      throw Error();
    }
    const result: RType[] = [];
    for (const node of nodes) {
      L_Executor.nodeExec(env, node);
      if (print) {
        if (printCode) console.log("***  results  ***\n");
        env.printClearMessage();
        console.log();
      }
    }

    return result;
  } catch {
    env.printClearMessage();
    return undefined;
  }
}

export function runStrings(env: L_Env, exprs: string[], print: boolean = true) {
  for (let i = 0; i < exprs.length; i++) {
    const expr = exprs[i];
    runString(env, expr, print);
  }

  console.log("-----\nDONE!\n");
  // env.printExists();
}

export async function runFile(
  filePath: string,
  print: boolean = true,
  printCode: boolean = false
) {
  try {
    const content: string = await Deno.readTextFile(filePath);
    const env = new L_Env(undefined);
    runString(env, content, print, printCode);
  } catch {
    console.error(`Error reading file:${filePath}.`);
  }
}
