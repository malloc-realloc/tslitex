import {
  KnowNode,
  L_Node,
  LetNode,
  OptNode,
  IfThenNode,
  FactNode,
  OrNode,
  DeclNode,
  IffDeclNode,
  IfThenDeclNode,
  ProveNode,
  ExistNode,
  HaveNode,
  AssumeByContraNode,
  OnlyIfDeclNode,
  LogicalOptNode,
  IffNode,
  OnlyIfNode,
  ByNode,
} from "./ast";
import { L_Env } from "./env";
import { checker } from "./checker";
import { L_Builtins } from "./builtins";
import { L_Storage } from "./L_Storage";

export enum RType {
  Error,
  True, // not only used as True for callInferExec, but also as a generic type passed between subFunctions.
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

function handleExecError(env: L_Env, out: RType, m: string = "") {
  env.newMessage(m);
  return out;
}

/**
 * Guideline of what execute functions do
 * 1. return RType thing
 * 2. env.newMessage()
 */
export namespace executor {
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
    ByNode: byExec,
  };

  export function nodeExec(env: L_Env, node: L_Node): RType {
    try {
      const nodeType = node.constructor.name;
      const execFunc = nodeExecMap[nodeType];

      if (execFunc && execFunc(env, node) === RType.True)
        return successMesIntoEnv(env, node);
      else if (node instanceof FactNode) {
        try {
          // return factExec(env, node as FactNode);
          const out = yaFactExec(env, node as FactNode);
          if (out === RType.True) {
            env.newMessage(`OK! ${node}`);
          }
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

  function successMesIntoEnv(env: L_Env, node: L_Node): RType {
    env.newMessage(`OK! ${node.toString()}`);
    return RType.True;
  }

  //! Here is where a new fact is generated by previous facts
  /**
   * Steps
   * 1. check fact
   * 2. know new fact
   */
  function factExec(env: L_Env, node: FactNode): RType {
    try {
      if (node instanceof OptNode) {
        const func = L_Builtins.get(node.fullName);
        if (func) return func(env, node);
      }

      const res = checker.check(env, node as FactNode);
      if (res.type === RType.True) {
        if (res.checkedByOpt === false) knowExec(env, new KnowNode([node]));
        return successMesIntoEnv(env, node);
      } else if (res.type === RType.Unknown) {
        env.newMessage(`Unknown. ${node.toString()}`);
        return RType.Unknown;
      } else if (res.type === RType.False) {
        env.newMessage(`False. ${node.toString()}`);
        return RType.False;
      } else if (res.type === RType.Error) {
        env.newMessage(`Error: ${node.toString()}`);
        return RType.Error;
      }
      return RType.Error;
    } catch (error) {
      env.newMessage(`Error: ${node.toString()}`);
      return RType.Error;
    }
  }

  function haveExec(env: L_Env, node: HaveNode): RType {
    try {
      // Check duplicate variable declarations
      const noErr = env.declareNewVar(node.vars);
      if (!noErr) {
        env.newMessage(
          `Error: Variable(s) ${node.vars.join(", ")} already declared in this scope.`
        );
        return RType.Error;
      }

      for (const fact of node.facts) {
        if (fact instanceof OptNode) {
          const out = checker.checkOptInHave(env, fact);
          if (out !== RType.True) {
            env.newMessage(`Unknown: ${node.toString()}`);
            return out;
          }
        } else {
          //! For the time being, if-then can not be checked when have
          env.newMessage(`Error: ${node.toString()}`);
          return RType.Error;
        }
      }

      knowExec(env, new KnowNode(node.facts));

      return RType.True;
    } catch (error) {
      env.newMessage(`Error: ${node.toString()}`);
      return RType.Error;
    }
  }

  function letExec(env: L_Env, node: LetNode): RType {
    try {
      // Check duplicate variable declarations
      const noErr = env.declareNewVar(node.vars);
      if (!noErr) {
        env.newMessage(
          `Error: Variable(s) ${node.vars.join(", ")} already declared in this scope.`
        );
        return RType.Error;
      }

      knowExec(env, new KnowNode(node.facts));

      return RType.True;
    } catch (error) {
      env.newMessage(`Error: ${node.toString()}`);
      return RType.Error;
    }
  }

  /**
   * Main Function of whole project. Not only used at assume expression, other expressions which introduces new fact into environment calls this function.
   *
   * know Opt: store directly
   * know if-then: if then is Opt, store it bound with if as req; if then is if-then, inherit father req and do knowExec again.
   */
  //! This one of the functions in which new facts are generated.
  //! In order to unify interface, after checking a fact, we use KnowExec to emit new fact
  export function knowExec(
    env: L_Env,
    node: KnowNode,
    fatherReq: FactNode[] = [],
    varsToHash: string[] = []
  ): RType {
    try {
      for (const fact of node.facts) {
        if (fact instanceof OptNode) {
          const factType = env.getDeclFact(fact.fullName);
          if (factType === undefined)
            throw Error(`${fact.fullName} not declared.`);

          const isT = env.varsAreNotDeclared(fact.vars);
          if (isT) throw Error(`Not all of ${fact.vars} are declared.`);

          env.addOptFact(fact, [...fatherReq]);

          //! new storage system
          const vars = fact.vars.map((s) =>
            s.startsWith("#") ? s.slice(1) : s
          );
          const freeVars = fact.vars
            .filter((s) => s.startsWith("#"))
            .map((s) => s.slice(1));
          env.storeFact(fact.fullName, vars, [], fact.isT, freeVars);
        } else if (fact instanceof LogicalOptNode) {
          if (fact instanceof IfThenNode) {
            knowLogicalOpt(
              env,
              [...fact.vars, ...varsToHash],
              fact.onlyIfs,
              fact.req,
              fatherReq
            );
          } else if (fact instanceof IffNode) {
            knowLogicalOpt(
              env,
              [...fact.vars, ...varsToHash],
              fact.onlyIfs,
              fact.req,
              fatherReq
            );
            knowLogicalOpt(
              env,
              [...fact.vars, ...varsToHash],
              fact.req,
              fact.onlyIfs,
              fatherReq
            );
          } else if (fact instanceof OnlyIfNode) {
            knowLogicalOpt(
              env,
              [...fact.vars, ...varsToHash],
              fact.req,
              fact.onlyIfs,
              fatherReq
            );
          } else {
            throw Error();
          }
        }
      }

      return RType.True;
    } catch (error) {
      let m = `'${node.toString()}'`;
      if (error instanceof Error) m += ` ${error.message}`;
      env.newMessage(m);
      throw error;
    }
  }

  function knowLogicalOpt(
    env: L_Env,
    varsToHash: string[],
    knowWhat: FactNode[],
    req: FactNode[],
    fatherReq: FactNode[]
  ): void {
    fatherReq.forEach((e) => e.hashVars(varsToHash));
    req.forEach((e) => e.hashVars(varsToHash));
    for (const onlyIf of knowWhat) {
      if (onlyIf instanceof OptNode) {
        onlyIf.hashVars(varsToHash);
        env.addOptFact(onlyIf, [...fatherReq, ...req]);
      } else {
        knowExec(
          env,
          new KnowNode([onlyIf]),
          [...fatherReq, ...req],
          [...varsToHash]
        );
      }
    }
  }

  function declExec(env: L_Env, node: DeclNode): RType {
    try {
      if (env.getDeclFact(node.name)) {
        throw Error(`${node.name} already declared.`);
      }

      env.setDeclFact(node.name, node);

      // new storage system
      let out = L_Storage.storeFactInDecl(env, node);
      if (!out) {
        env.newMessage(`Declaration of ${node} failed.`);
        return RType.Error;
      }

      const definedFact = new OptNode(node.name, [...node.vars]);
      definedFact.hashVars(node.vars);

      // at the end of declExec, node.rmvHashFromVars
      // NOTE: node.vars are not hashed.
      node.hashVars(node.vars);

      if (node instanceof IffDeclNode || node instanceof ExistNode) {
        // we declare and exe exist-fact by exactly using Opt code.

        /** Notice the following 4 knowExec can be reduced to 2 */
        // req => itself; req => onlyIfs
        knowExec(
          env,
          new KnowNode([
            new IfThenNode(
              definedFact.vars,
              [definedFact, ...node.req],
              [...node.onlyIfs]
            ),
          ])
        );

        // //! The whole checking process might be locked by "req => itself, itself =>req"
        // itself => req ; itself => onlyIfs
        knowExec(
          env,
          new KnowNode([
            new IfThenNode(
              definedFact.vars,
              [...node.onlyIfs, ...node.req],
              [definedFact]
            ),
          ])
        );
      } else if (node instanceof IfThenDeclNode) {
        // factType = FactType.IfThen;

        // req + itself => onlyIf
        // const definedFact = new OptNode(node.name, node.vars);
        knowExec(
          env,
          new KnowNode([
            new IfThenNode(
              // definedFact.vars,
              node.vars,
              [definedFact, ...node.req],
              [...node.onlyIfs]
            ),
          ])
        );
      } else if (node instanceof OnlyIfDeclNode) {
        // factType = FactType.OnlyIf;

        knowExec(
          env,
          new KnowNode([
            new IfThenNode(
              // definedFact.vars,
              node.vars,
              [...node.onlyIfs, ...node.req],
              [definedFact]
            ),
          ])
        );
      } else if (node instanceof OrNode) {
        // factType = FactType.Or;
      }

      // clean up hash added to declFact
      // node.rmvHashFromVars(node.vars);

      return RType.True;
    } catch (error) {
      let m = `'${node.toString()}'`;
      if (error instanceof Error) m += ` ${error.message}`;
      env.newMessage(m);
      throw error;
    }
  }

  function proveExec(env: L_Env, node: ProveNode): RType {
    const newEnv = new L_Env(env);
    if (node.toProve !== null) {
      // prove vanilla if-then
      newEnv.declareNewVar(node.toProve.vars);
      knowExec(newEnv, new KnowNode(node.toProve.req));
      // execute prove block
      for (const subNode of node.block) {
        const out = nodeExec(newEnv, subNode);
        if (out !== RType.True) {
          return handleExecError(
            env,
            out,
            `Proof Block Expression ${subNode} failed.`
          );
        }
      }

      // check
      for (const toTest of node.toProve.onlyIfs) {
        const out = checker.check(newEnv, toTest);
        if (!(out.type === RType.True)) {
          return handleExecError(
            env,
            out.type,
            `Proof failed to prove ${toTest}.`
          );
        }
      }

      // store new fact into env
      node.toProve.hashVars(node.toProve.vars);
      knowExec(
        env,
        new KnowNode([
          new IfThenNode(
            node.toProve.vars,
            node.toProve.req,
            node.toProve.onlyIfs
          ),
        ])
      );

      return RType.True;
    } else if (node.fixedIfThenOpt !== null) {
      // prove declared opt
      const originalDeclFact = env.getDeclFact(node.fixedIfThenOpt.fullName);
      if (originalDeclFact === undefined) {
        return handleExecError(
          env,
          RType.Error,
          `${node.fixedIfThenOpt.fullName} is not declared.`
        );
      }

      // We must create a new declFact to avoid overwriting original declFact when hashing and removing hashes. The reason is that if we directly change the original declFact, storedFacts are changed because they are referenced to original declFact.
      const declFact = new IfThenDeclNode("", [], [], []);
      originalDeclFact.copyTo(declFact);
      declFact.rmvHashFromVars(declFact.vars);

      if (!(declFact instanceof IfThenDeclNode)) {
        return handleExecError(
          env,
          RType.Error,
          `${node.fixedIfThenOpt.fullName} is not if-type operator.`
        );
      }

      // Replace all free variables in the declared node with the given variables
      const originalOptVars = [...node.fixedIfThenOpt.vars];

      // eliminate # so that user don't need to type #
      for (let i = 0; i < node.fixedIfThenOpt.vars.length; i++) {
        if (node.fixedIfThenOpt.vars[i].startsWith("#"))
          node.fixedIfThenOpt.vars[i] = node.fixedIfThenOpt.vars[i].slice(1);
      }
      declFact.replaceVars(node.fixedIfThenOpt);

      // declare variables into newEnv
      newEnv.declareNewVar(node.fixedIfThenOpt.vars);

      // Assume all requirements of given operator is true
      knowExec(newEnv, new KnowNode(declFact.req));

      // execute prove block
      for (const subNode of node.block) {
        const out = nodeExec(newEnv, subNode);
        if (out !== RType.True) {
          return handleExecError(
            env,
            out,
            `Proof Block Expression ${subNode} failed.`
          );
        }
      }

      // check
      for (const toTest of declFact.onlyIfs) {
        const out = checker.check(newEnv, toTest);
        if (!(out.type === RType.True)) {
          return handleExecError(
            env,
            out.type,
            `Proof failed to prove ${toTest}.`
          );
        }
      }

      // store new fact into env
      node.fixedIfThenOpt.vars = originalOptVars;
      knowExec(env, new KnowNode([node.fixedIfThenOpt]));

      return RType.True;
    }

    return RType.Error;
  }

  /**
   * Steps
   * 1. open new Env
   * 2. assume node.assume
   * 3. run block
   * 4. check node.contradict, not node.contradict
   * 5. emit the reverse of node.assume
   */
  function assumeByContraExec(env: L_Env, node: AssumeByContraNode): RType {
    try {
      const newEnv = new L_Env(env);
      knowExec(newEnv, new KnowNode([node.assume]));
      for (const subNode of node.block) {
        const out = nodeExec(newEnv, subNode);
        if (out !== RType.True) {
          return handleExecError(
            env,
            out,
            `Proof Block Expression ${subNode} Failed.`
          );
        }
      }

      let out = checker.check(newEnv, node.contradict);
      if (!(out.type === RType.True)) {
        return handleExecError(
          env,
          out.type,
          `assume_by_contradiction failed to prove ${node.contradict}. Proof by contradiction requires checking both the statement and its negation.`
        );
      }

      node.contradict.isT = !node.contradict.isT;
      out = checker.check(newEnv, node.contradict);
      if (!(out.type === RType.True)) {
        return handleExecError(
          env,
          out.type,
          `assume_by_contradiction failed to prove ${node.contradict}. Proof by contradiction requires checking both the statement and its negation.`
        );
      }

      node.assume.isT = !node.assume.isT;
      knowExec(env, new KnowNode([node.assume]));
      return RType.True;
    } catch (error) {
      env.newMessage(`${node}`);
      return RType.Error;
    }
  }

  function byExec(env: L_Env, node: ByNode): RType {
    const newEnv = new L_Env(env);
    for (const subNode of node.block) {
      const out = nodeExec(newEnv, subNode);
      if (out !== RType.True) return out;
    }
    for (const fact of node.facts) {
      const out = nodeExec(newEnv, fact);
      if (out !== RType.True) return out;
    }
    knowExec(env, new KnowNode(node.facts));
    return RType.True;
  }

  function yaFactExec(env: L_Env, toCheck: FactNode): RType {
    try {
      let out = checker.checkFactFully(env, toCheck);
      if (out === RType.True) {
        if (toCheck instanceof OptNode) {
          const frees = toCheck.vars
            .filter((e) => e.startsWith("#"))
            .map((s) => s.slice(1));
          env.storeFact(toCheck.fullName, toCheck.vars, [], toCheck.isT, frees);
        } else if (toCheck instanceof IfThenNode) {
          const req = (toCheck as IfThenNode).req;
          const frees = (toCheck as IfThenNode).vars;
          for (const onlyIf of (toCheck as IfThenNode).onlyIfs) {
            if (onlyIf instanceof OptNode) {
              env.storeFact(
                onlyIf.fullName,
                onlyIf.vars,
                req,
                toCheck.isT,
                frees
              );
            }
          }
        }
      }
      return out;
    } catch (error) {
      env.newMessage(`failed to check ${toCheck}`);
      return RType.Error;
    }
  }
}
