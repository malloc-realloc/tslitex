import {
  // ByNode,
  DeclNode,
  ToCheckNode,
  IffDeclNode,
  IfDeclNode,
  OnlyIfDeclNode,
  OptNode,
  OrNode,
  // ExistNode,
  ExistDeclNode,
  IfNode,
} from "./ast.ts";
import { L_Builtins } from "./L_Builtins.ts";
import { L_Env } from "./L_Env.ts";
import { DEBUG_DICT, RType } from "./L_Executor.ts";

export class DefNameDecl {
  constructor(
    public name: string,
    public ifVars: string[],
    public req: ToCheckNode[],
    public itself: ToCheckNode
  ) {}

  pushBeginNewReq(ifThen: IfNode) {
    this.ifVars = [...ifThen.vars, ...this.ifVars];
    this.req = [...ifThen.req, ...this.req];
  }

  toDeclNode(): DeclNode {
    return new IffDeclNode(
      this.name,
      this.ifVars,
      [...this.req],
      [this.itself]
    );
  }

  toIfNodeIfNodeAsOnlyIf(): IfNode {
    const req = new OptNode(this.name, this.ifVars);
    const onlyIf = new IfNode([], this.req, [this.itself]);
    return new IfNode(this.ifVars, [req, ...this.req], [onlyIf]);
    // return new IfNode(this.ifVars, [req, ...this.req], [this.itself]);
  }

  toIfNodeIfNodeAsIf(): IfNode {
    const onlyIf = new OptNode(this.name, this.ifVars);
    const req = new IfNode([], this.req, [this.itself]);
    return new IfNode(this.ifVars, [req], [onlyIf]);
  }
}

export class MemorizedExistDecl {
  constructor(
    private ifVars: string[],
    private existVars: string[],
    private existFacts: ToCheckNode[]
  ) {
    //! MUST CHECK NO DOUBLE DECLARATION IN [...ifVars, ...vars]
  }

  instantiate(
    env: L_Env,
    ifVars: string[],
    existVars: string[]
  ): ToCheckNode[] | undefined {
    const map = new Map<string, string>();
    if (ifVars.length !== this.ifVars.length) {
      env.newMessage(
        `Invalid number of parameters, get ${ifVars.length}, require ${ifVars.length}`
      );
      return undefined;
    }
    for (let i = 0; i < ifVars.length; i++) {
      map.set(this.ifVars[i], ifVars[i]);
    }
    for (let i = 0; i < existVars.length; i++) {
      map.set(this.existVars[i], existVars[i]);
    }
    const newFacts = this.existFacts.map((e) => e.useMapToCopy(map));
    return newFacts;
  }
}

export class StoredReq {
  constructor(
    public vars: string[], // store free vars at current level
    public req: ToCheckNode[]
  ) {}

  toString() {
    return `(if ${this.vars.join(", ")} : ${this.req
      .map((e) => e.toString())
      .join(", ")})`;
  }
}

export class StoredFact {
  public onlyIfs: ToCheckNode[] = []; //? MAYBE USELESS

  constructor(
    public vars: string[], // stored fixed, only used when storing opts
    public req: StoredReq[], // when adding a new layer of if-then, push a new req list (ToCheckNode[]) at end of req.
    public isT: boolean
  ) {}

  toString() {
    const notWords = this.isT === false ? "[not] " : "";
    const varsWords = this.vars.length > 0 ? this.vars.join(", ") : "";
    const reqWords =
      this.req.length > 0
        ? " <= " + this.req.map((e) => e.toString()).join(", ")
        : "";
    const onlyIfWords =
      this.onlyIfs.length > 0 ? `\n onlyIfs: ${this.onlyIfs}\n` : "";

    const out = notWords + varsWords + reqWords + onlyIfWords;

    return out;
  }

  getAllFreeVars() {
    const varsLst: string[][] = this.req.map((e) => e.vars);
    let out: string[] = [];
    varsLst.forEach((e) => {
      out = [...out, ...e];
    });
    return out;
  }

  getFixedVars() {
    const out = [];
    const frees = this.getAllFreeVars();
    for (const v of this.vars) {
      if (!frees.includes(v)) out.push(v);
    }
    return out;
  }

  isNoReq(): boolean {
    for (const req of this.req) {
      if (req.req.length !== 0) return false;
    }
    return true;
  }

  checkLiterally(toCheckFixedVars: string[], isT: boolean): RType {
    const noExtraReq = this.req.every((e) => e.req.length === 0);
    if (!noExtraReq) return RType.Unknown;

    if (isT !== this.isT) return RType.Unknown;

    //! the following check is based on hypothesis that toCheckFixedVars declared at different level are different
    const frees = this.getAllFreeVars();
    for (const [i, v] of toCheckFixedVars.entries()) {
      if (frees.includes(v)) continue;
      else if (toCheckFixedVars[i] === this.vars[i]) continue;
      else return RType.Unknown;
    }

    return RType.True;
  }
}

export function declNewFact(env: L_Env, node: DeclNode): boolean {
  let ok = true;

  ok = env.safeDeclOpt(node.name, node);
  if (!ok) {
    return false;
  }

  const decl = new OptNode(node.name, node.vars, true, undefined);
  if (node instanceof IfDeclNode) {
    const r = [decl, ...node.req];
    const f = new IfNode(node.vars, r, node.onlyIfs, true, undefined);
    ok = storeIfThen(env, f, [], true);
  } else if (node instanceof IffDeclNode) {
    const left = new IfNode(
      node.vars,
      [decl, ...node.req],
      node.onlyIfs,
      true,
      undefined
    );
    ok = storeIfThen(env, left, [], true);
    if (!ok) {
      return false;
    }

    const right = new IfNode(
      node.vars,
      node.onlyIfs,
      [decl, ...node.req],
      true,
      undefined
    );
    ok = storeIfThen(env, right, [], true);
    if (!ok) {
      return false;
    }
  } else if (node instanceof OnlyIfDeclNode) {
    const r = [...node.req, decl];
    const f = new IfNode(node.vars, node.onlyIfs, r, true, undefined);
    ok = storeIfThen(env, f, [], true);
  } else if (node instanceof ExistDeclNode) {
    ok = true;
  }

  return ok;
}

function storeIfThen(
  env: L_Env,
  ifThen: IfNode,
  req: StoredReq[],
  storeContrapositive: boolean
): boolean {
  try {
    if (ifThen.isT) {
      for (const fact of ifThen.onlyIfs) {
        const newReq = new StoredReq(ifThen.vars, ifThen.req);
        const ok = store(env, fact, [...req, newReq], storeContrapositive);
        if (!ok) return false;
      }

      // if (ifThen.isIff) {
      //   for (const fact of ifThen.req) {
      //     const ok = store(
      //       env,
      //       fact,
      //       [...req, new StoredReq(ifThen.vars, ifThen.onlyIfs)],
      //       storeContrapositive
      //     );
      //     if (!ok) return false;
      //   }
      // }

      return true;
    } else {
      if (ifThen.defName === undefined) {
        env.newMessage(
          `Failed to store ${ifThen}, because not-if-then is suppose to have a name.`
        );
      }

      return false;

      // declareAndStoreExist(env);
      // const exist = ExistNode.ifThenToExist(ifThen);
      // return declareAndStoreExist(env, exist, [], true);
    }
  } catch {
    return false;
  }
}

function storeOpt(
  env: L_Env,
  fact: OptNode,
  req: StoredReq[],
  storeContrapositive: boolean
): boolean {
  if (L_Builtins.get(fact.name) !== undefined) return true;

  const declaredOpt = env.getDeclaredFact(fact.name);
  if (declaredOpt === undefined) {
    env.newMessage(`${fact.name} undeclared`);
    return false;
  } else {
    // TODO: I GUESS I SHOULD CHECK WHETHER GIVEN VARS SATISFY WHEN IN DEF
    if (declaredOpt.vars.length !== fact.vars.length) {
      env.newMessage(
        `${fact.name} requires ${declaredOpt.vars.length} parameters, ${fact.vars.length} given.`
      );
      return false;
    }
  }

  env.newFact(fact.name, fact.vars, req, fact.isT);

  // store contra positive when storing Opt.
  if (storeContrapositive) storeContrapositiveFacts(env, fact, req);

  if (DEBUG_DICT["newFact"]) {
    const notWords = fact.isT === false ? "[not]" : "";
    if (req.length > 0)
      env.newMessage(`[fact] ${notWords} ${fact.name}(${fact.vars}) <= ${req}`);
    else env.newMessage(`[fact] ${notWords} ${fact.name}(${fact.vars})`);
  }

  return true;
}

function storeOr(
  env: L_Env,
  fact: OrNode,
  req: StoredReq[],
  storeContrapositive: boolean
): boolean {
  for (let i = 0; i < fact.facts.length; i++) {
    const asReq: ToCheckNode[] = [];
    for (let j = 0; j < fact.facts.length; j++) {
      if (j !== i) {
        asReq.push(fact.facts[j].copyWithoutIsT(!fact.facts[j].isT));
      }
    }
    const ok = store(
      env,
      fact.facts[i],
      [...req, new StoredReq([], asReq)],
      storeContrapositive
    );
    if (!ok) return ok;
  }
  return true;
}

// Main Function of Storage
export function store(
  env: L_Env,
  fact: ToCheckNode,
  req: StoredReq[] = [],
  storeContrapositive: boolean
): boolean {
  try {
    if (fact instanceof IfNode) {
      const ok = storeIfThen(env, fact, req, storeContrapositive);
      if (!ok) return false;
    } else if (fact instanceof OptNode) {
      const ok = storeOpt(env, fact, req, storeContrapositive);
      if (!ok) return false;
    } else if (fact instanceof OrNode) {
      const ok = storeOr(env, fact, req, storeContrapositive);
      if (!ok) return false;
    } else throw Error();

    return true;
  } catch {
    env.newMessage(`Function L_Memory store error: ${fact}, req is ${req}.`);
    return false;
  }
}

/** MAIN FUNCTION OF THE WHOLE PROJECT
 *  Given an operator-type fact, return all stored facts that might check this fact.
 *  Only stored fact of correct environment level, i.e. if there are operators or variables with
 *  with the same name declared at some upper environment, Then these stored facts
 *  should are illegal to be returned.
 *
 *  @returns null means error. StoredFact[] is used to hold all legal stored facts.
 */
export function getStoredFacts(env: L_Env, opt: OptNode): StoredFact[] | null {
  // varDeclaredNumberMap is used to store how many times a variable is declared in all visible environments
  const varsAsSet = new Set(opt.vars);
  const varDeclaredNumberMap = new Map<string, number>();
  for (const v of varsAsSet) {
    varDeclaredNumberMap.set(v, 0);
  }

  // know where the opt is declared.
  let visibleEnvLevel = -1;
  const tmp = env.whereIsOptDeclared(opt.name);
  if (tmp !== undefined) {
    visibleEnvLevel = tmp;
  } else {
    env.newMessage(`${opt} not declared.`);
    return null;
  }

  // get fact from every visible env
  const out: StoredFact[] = [];
  for (
    let i = 0, curEnv: L_Env = env;
    i <= visibleEnvLevel && curEnv;
    i++, curEnv = curEnv.getFather() as L_Env
  ) {
    // update how many times a given var is declared
    for (const v of varsAsSet) {
      if (curEnv.varDeclaredAtCurrentEnv(v)) {
        const curNumber = varDeclaredNumberMap.get(v) as number;
        varDeclaredNumberMap.set(v, curNumber + 1);
      }
    }

    // get stored facts from current environment level
    const facts = curEnv.getStoredFactsFromCurrentEnv(opt.name);
    if (facts === undefined) continue;

    for (const fact of facts) {
      const fixedVarsAtFact = fact.getFixedVars();

      // If the var is declared at a higher level, then the fact is RELATED TO THE VARIABLE WITH THE SAME NAME AT HIGHER LEVEL, NOT RELATED WITH CURRENT VARIABLE
      let invisible = false;
      for (const v of fixedVarsAtFact) {
        if (varsAsSet.has(v) && (varDeclaredNumberMap.get(v) as number) > 1) {
          invisible = true;
          break;
        }
      }

      if (invisible) continue;
      else out.push(fact);
    }

    // const facts = curEnv.getStoredFactsFromCurrentEnv(opt.name);
    // if (facts === undefined) continue;
    // else out = [...out, ...facts];
  }

  return out;
}

export function storeFact(
  env: L_Env,
  fact: ToCheckNode,
  storeContrapositive: boolean
): boolean {
  try {
    if (fact instanceof OptNode) {
      return storeOpt(env, fact as OptNode, [], storeContrapositive);
    } else if (fact instanceof IfNode) {
      const ok = storeIfThen(env, fact, [], storeContrapositive);
      if (!ok) {
        env.newMessage(`Failed to store ${fact}`);
        return false;
      }
      return true;
    } else if (fact instanceof OrNode) {
      return storeOr(env, fact, [], storeContrapositive);
    } else throw Error();
  } catch {
    env.newMessage(`Failed to store ${fact}`);
    return false;
  }
}

function storeContrapositiveFacts(
  env: L_Env,
  fact: OptNode,
  req: StoredReq[]
): boolean {
  let freeVars: string[] = [];
  let allStoredFactReq: ToCheckNode[] = [];
  for (const r of req) {
    freeVars = [...freeVars, ...r.vars];
    allStoredFactReq = [...allStoredFactReq, ...r.req];
  }

  const factInverse = fact.copyWithoutIsT(!fact.isT);

  for (let i = 0; i < allStoredFactReq.length; i++) {
    const r = allStoredFactReq.filter((_, index) => index !== i);
    r.push(factInverse);
    const ifThen = new IfNode(
      freeVars,
      r,
      [allStoredFactReq[i].copyWithoutIsT(!allStoredFactReq[i].isT)],
      true,
      undefined
      // false
    );
    const ok = storeIfThen(env, ifThen, [], false);
    if (!ok) return false;
  }

  return true;
}

export function declDefNames(env: L_Env, facts: ToCheckNode[]): boolean {
  try {
    // Inline getDefNameDecls logic
    let defs: DefNameDecl[] = [];
    for (const f of facts) {
      const newDefs = f.getSubFactsWithDefName();
      defs = [...defs, ...newDefs];
    }

    for (const def of defs) {
      env.safeDeclOpt(def.name, def.toDeclNode());
    }

    // Process the declarations
    for (const decl of defs) {
      let ok = true;
      let store = decl.toIfNodeIfNodeAsOnlyIf();
      ok = storeIfThen(env, store, [], true);
      if (!ok) {
        env.newMessage(`Failed to store ${store}`);
        return false;
      }

      store = decl.toIfNodeIfNodeAsIf();
      // Before implementing not exist req st onlyIf <=> for all req then onlyIf
      // Here is false.
      ok = storeIfThen(env, store, [], false);
      if (!ok) {
        env.newMessage(`Failed to store ${store}`);
        return false;
      }

      env.newMessage(`[def] ${decl.toDeclNode()}`);

      // // declare contrapositive exist
      // const exist = new ExistDeclNode(decl.name, decl.ifVars, decl.req, )
      // env.declNewExist()
    }
    return true;
  } catch {
    return false;
  }
}
