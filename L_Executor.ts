import {
  KnowNode,
  L_Node,
  LetNode,
  FactNode,
  DeclNode,
  ProveNode,
  HaveNode,
  AssumeByContraNode,
  ByNode,
} from "./ast";
import { L_Env } from "./L_Env";
import { checker } from "./L_Checker";
import { L_Storage } from "./L_Storage";

export enum RType {
  Error,
  True,
  KnowUndeclared,
  False,
  Unknown,
  HaveFailed,
  ProveFailed,
  ThmFailed,
}

export const RTypeMap: { [key in RType]: string } = {
  [RType.Error]: "error",
  [RType.False]: "check: false",
  [RType.True]: "check: true",
  [RType.Unknown]: "check: unknown",
  [RType.KnowUndeclared]: "know: undeclared opt",
  [RType.HaveFailed]: "have: failed",
  [RType.ProveFailed]: "prove: failed",
  [RType.ThmFailed]: "thm: failed",
};

function successMesIntoEnv(env: L_Env, node: L_Node): RType {
  env.newMessage(`OK! ${node.toString()}`);
  return RType.True;
}

export namespace L_Executor {
  const nodeExecMap: { [key: string]: (env: L_Env, node: any) => RType } = {
    IffDeclNode: declExec,
    IfThenDeclNode: declExec,
    ExistNode: declExec,
    OnlyIfDeclNode: declExec,
    KnowNode: knowExec,
    LetNode: letExec,
    ProveNode: proveExec,
    HaveNode: haveExec,
    AssumeByContraNode: assumeByContraExec,
    ByNode: _byExec,
  };

  export function nodeExec(env: L_Env, node: L_Node): RType {
    try {
      const nodeType = node.constructor.name;
      const execFunc = nodeExecMap[nodeType];

      if (execFunc && execFunc(env, node) === RType.True)
        return successMesIntoEnv(env, node);
      else if (node instanceof FactNode) {
        try {
          const out = factExec(env, node as FactNode);
          if (out === RType.True) {
            env.newMessage(`OK! ${node}`);
          } else if (out === RType.Unknown) {
            env.newMessage(`Unknown ${node}`);
          } else if (out === RType.Error) {
            env.newMessage(`Error ${node}`);
          }
          return out;
        } catch (error) {
          throw Error(`${node as FactNode}`);
        }
      }
      return RType.Error;
    } catch (error) {
      if (error instanceof Error) env.newMessage(`Error: ${error.message}`);
      return RType.Error;
    }
  }

  function haveExec(env: L_Env, node: HaveNode): RType {
    try {
      return RType.True;
    } catch (error) {
      env.newMessage(`Error: ${node.toString()}`);
      return RType.Error;
    }
  }

  function letExec(env: L_Env, node: LetNode): RType {
    try {
      node.vars.forEach((e) => env.newVar(e, e));
      for (const f of node.facts) L_Storage.store(env, f, []);
      return RType.True;
    } catch (error) {
      env.newMessage(`Error: ${node.toString()}`);
      return RType.Error;
    }
  }

  export function knowExec(env: L_Env, node: KnowNode): RType {
    try {
      for (const fact of node.facts) L_Storage.store(env, fact, []);

      return RType.True;
    } catch (error) {
      let m = `'${node.toString()}'`;
      if (error instanceof Error) m += ` ${error.message}`;
      env.newMessage(m);
      throw error;
    }
  }

  function declExec(env: L_Env, node: DeclNode): RType {
    try {
      if (env.isOptDeclared(node.name))
        throw Error(`${node.name} already declared.`);

      env.setDeclFact(node.name, node);
      L_Storage.declNewFact(env, node);

      return RType.True;
    } catch (error) {
      let m = `'${node.toString()}'`;
      if (error instanceof Error) m += ` ${error.message}`;
      env.newMessage(m);
      throw error;
    }
  }

  function proveExec(env: L_Env, node: ProveNode): RType {
    return RType.True;
  }

  function assumeByContraExec(env: L_Env, node: AssumeByContraNode): RType {
    try {
      return RType.True;
    } catch (error) {
      env.newMessage(`${node}`);
      return RType.Error;
    }
  }

  function _byExec(env: L_Env, node: ByNode): RType {
    return RType.True;
  }

  function factExec(env: L_Env, toCheck: FactNode): RType {
    try {
      let out = checker.L_Check(env, toCheck);
      if (out === RType.True) {
        L_Storage.store(env, toCheck, []);
      }
      return out;
    } catch (error) {
      env.newMessage(`failed to check ${toCheck}`);
      return RType.Error;
    }
  }
}