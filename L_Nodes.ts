import { L_Env } from "./L_Env";
import { L_KW } from "./L_Keywords";
import { L_Composite, L_OptSymbol, L_Singleton, L_Symbol } from "./L_Structs";

export abstract class L_Node {}

export abstract class L_FactNode extends L_Node {
  // checkVars: L_Symbol[][] = [];

  constructor(public isT: boolean) {
    super();
  }

  // called by L_Memory
  abstract tryFactVarsDeclared(env: L_Env): void;
  // called by checker
  abstract fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): L_FactNode; // called by prove_by_contradiction
  abstract copyWithIsTReverse(): L_FactNode;
  // called by "using known fact to check given fact. when doing so, get all root opts and filter opt with the same name."
  abstract getRootOptNodes(): [OptFactNode, L_FactNode[]][];
}

export type IfVarsFormReqType = {
  key: L_Singleton;
  freeVars: L_Singleton[];
  form: L_Symbol;
};
export abstract class LogicNode extends L_FactNode {
  constructor(
    public vars: L_Singleton[] = [],
    public req: L_FactNode[] = [],
    public onlyIfs: L_FactNode[] = [],
    isT: boolean = true,
    public varsFormReq: IfVarsFormReqType[] // public varsForm: [L_Singleton, L_Singleton[], L_Symbol][]
  ) {
    super(isT);
  }

  private addPrefixToVars(): boolean {
    this.vars = this.vars.map((e) => new L_Singleton(L_KW.IfVarPrefix + e));

    // TODO form is not done
    this.varsFormReq.forEach((e) => (e.key = e.key.withIfVarPrefix()));
    this.varsFormReq.forEach(
      (e) => (e.freeVars = e.freeVars.map((v) => v.withIfVarPrefix()))
    );

    for (const r of this.req) {
      if (r instanceof LogicNode) {
        r.addPrefixToVars();
      }
    }

    for (const onlyIf of this.onlyIfs) {
      if (onlyIf instanceof LogicNode) {
        onlyIf.addPrefixToVars();
      }
    }

    return true;
  }

  fixUsingIfPrefix(env: L_Env, freeFixPairs: [L_Symbol, L_Symbol][]): boolean {
    try {
      let newFreeFixPairs: [L_Symbol, L_Symbol][] = this.vars.map((e) => [
        e,
        new L_Singleton(L_KW.IfVarPrefix + e.value),
      ]);
      for (const formReq of this.varsFormReq) {
        for (const formFreeVar of formReq.freeVars) {
          newFreeFixPairs.push([
            formFreeVar,
            new L_Singleton(L_KW.IfVarPrefix + formFreeVar.value),
          ]);
        }
      }
      freeFixPairs = [...freeFixPairs, ...newFreeFixPairs];
      this.req = this.req.map((r) => r.fixByIfVars(env, freeFixPairs));
      this.onlyIfs = this.onlyIfs.map((onlyIf) =>
        onlyIf.fixByIfVars(env, freeFixPairs)
      );

      this.varsFormReq.forEach((e) => (e.form = e.form.fix(env, freeFixPairs)));

      this.addPrefixToVars();

      return true;
    } catch (error) {
      return false;
    }
  }

  static makeFreeFixPairs(
    env: L_Env,
    fixed: L_Symbol[],
    free: L_Symbol[]
  ): [L_Symbol, L_Symbol][] {
    const out: [L_Symbol, L_Symbol][] = [];
    for (let i = 0; i < free.length; i++) {
      out.push([free[i], fixed[i]]);
    }

    return out;
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    const roots = this.onlyIfs.map((e) => e.getRootOptNodes()).flat();
    for (const root of roots) {
      root[1] = [this, ...root[1]];
    }
    return roots;
  }

  override tryFactVarsDeclared(env: L_Env): void {
    const newEnv = new L_Env(env);
    for (const v of this.vars) {
      newEnv.tryNewPureSingleton(v.value);
    }

    for (const formReq of this.varsFormReq) {
      formReq.freeVars.forEach((e) => newEnv.tryNewPureSingleton(e.value));
    }

    for (const req of this.req) {
      req.tryFactVarsDeclared(newEnv);
    }

    for (const onlyIf of this.onlyIfs) {
      onlyIf.tryFactVarsDeclared(newEnv);
    }
  }
}

export class IffNode extends LogicNode {
  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): LogicNode {
    const newReq: L_FactNode[] = [];
    for (const r of this.req) {
      newReq.push(r.fixByIfVars(env, freeFixPairs));
    }

    const newOnlyIf: L_FactNode[] = [];
    for (const onlyIf of this.onlyIfs) {
      newOnlyIf.push(onlyIf.fixByIfVars(env, freeFixPairs));
    }

    return new IffNode(
      this.vars,
      newReq,
      newOnlyIf,
      this.isT,
      this.varsFormReq
    );
  }

  override copyWithIsTReverse(): IffNode {
    return new IffNode(
      this.vars,
      this.req,
      this.onlyIfs,
      !this.isT,
      this.varsFormReq
    );
  }

  override toString() {
    const mainPart = `iff ${this.vars.toString()} : ${this.req} {${
      this.onlyIfs
    }}`;
    const notPart = !this.isT ? "[not] " : "";

    return notPart + mainPart;
  }
}

export class IfNode extends LogicNode {
  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): LogicNode {
    const newReq: L_FactNode[] = [];
    for (const r of this.req) {
      newReq.push(r.fixByIfVars(env, freeFixPairs));
    }

    const newOnlyIf: L_FactNode[] = [];
    for (const onlyIf of this.onlyIfs) {
      newOnlyIf.push(onlyIf.fixByIfVars(env, freeFixPairs));
    }

    return new IfNode(this.vars, newReq, newOnlyIf, this.isT, this.varsFormReq);
  }

  override copyWithIsTReverse(): IfNode {
    return new IfNode(
      this.vars,
      this.req,
      this.onlyIfs,
      !this.isT,
      this.varsFormReq
    );
  }

  override toString() {
    let varsFormReqStr: string = "";
    if (this.varsFormReq.length > 0) {
      varsFormReqStr =
        "[" +
        this.varsFormReq
          .map((e) => `${e.key} (${e.freeVars}) : ${e.form}`)
          .join(",") +
        "]";
    }

    const mainPart = `if ${this.vars.toString()} ${varsFormReqStr}: ${
      this.req
    } {${this.onlyIfs}}`;
    const notPart = !this.isT ? "[not] " : "";

    return notPart + mainPart;
  }
}

export class IfReqNode {
  constructor(public fact: L_FactNode, public vars: L_Symbol[]) {}
}

export class OptFactNode extends L_FactNode {
  constructor(
    public optSymbol: L_OptSymbol,
    public vars: L_Symbol[],
    isT: boolean = true,
    public checkVars: L_Symbol[][] | undefined
  ) {
    super(isT);
  }

  newToChecks(checkVars: L_Symbol[][]): OptFactNode {
    return new OptFactNode(this.optSymbol, this.vars, this.isT, checkVars);
  }

  static literallyIdentical(
    env: L_Env,
    given: OptFactNode,
    expects: OptFactNode
  ): boolean {
    if (given.optSymbol.name !== expects.optSymbol.name) return false;
    return L_Symbol.symbolArrLiterallyIdentical(env, given.vars, expects.vars);
  }

  copyCommutatively(): OptFactNode | undefined {
    if (this.vars.length !== 2) {
      return undefined;
    }
    const newVars: L_Symbol[] = [this.vars[1], this.vars[0]];
    return new OptFactNode(this.optSymbol, newVars, this.isT, this.checkVars);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    return [[this, []]];
  }

  override tryFactVarsDeclared(env: L_Env): void {
    for (const v of this.vars) {
      try {
        v.tryVarsDeclared(env);
      } catch (error) {
        if (error instanceof Error)
          error.message =
            `variable ${v} in ${this} not declared.\n` + error.message;
        throw error;
      }
      // if (!v.tryVarsDeclared(env)) {
      //   return false;
      // }
    }

    if (this.checkVars === undefined) return;

    for (const layer of this.checkVars) {
      for (const v of layer) {
        try {
          v.tryVarsDeclared(env);
        } catch (error) {
          if (error instanceof Error)
            error.message =
              `variable ${v} in ${this} not declared.\n` + error.message;
          throw error;
        }
        // if (!v.tryVarsDeclared(env)) {
        //   return false;
        // }
      }
    }

    return;
  }

  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): OptFactNode {
    const newVars: L_Symbol[] = [];
    for (let v of this.vars) {
      let fixed = false;
      v = v.fix(env, freeFixPairs); // if v is singleton, then fix itself; if v is composite, then fix its variables.
      if (!fixed) newVars.push(v);
    }

    const newCheckVars = this.checkVars?.map((e) =>
      e.map((v) => v.fix(env, freeFixPairs))
    );

    return new OptFactNode(this.optSymbol, newVars, this.isT, newCheckVars);
  }

  override copyWithIsTReverse(): OptFactNode {
    return new OptFactNode(
      this.optSymbol,
      this.vars,
      !this.isT,
      this.checkVars
    );
  }

  override toString() {
    const mainPart = "$" + this.optSymbol.name + `(${this.vars})`;
    const notPart = !this.isT ? "[not] " : "";
    const checkVarsStr =
      this.checkVars === undefined
        ? ""
        : "[" +
          this.checkVars
            .map((e) => e.map((j) => j.toString()).join(", "))
            .join("; ") +
          "]";
    return notPart + mainPart + checkVarsStr;
  }
}

export class DefConceptNode extends L_Node {
  constructor(
    public opt: OptFactNode,
    public cond: L_FactNode[], // TODO, 类似composite的要求
    public onlyIfs: L_FactNode[],
    public commutative: boolean
  ) {
    super();
  }

  override toString(): string {
    return `${this.opt.toString()};`;
  }
}

export class KnowNode extends L_Node {
  isKnowEverything: boolean = false;

  constructor(public facts: L_FactNode[], public names: string[]) {
    super();
  }

  override toString(): string {
    return `${L_KW.Know} ${this.facts};`;
  }
}

export class LetNode extends L_Node {
  constructor(public vars: string[], public facts: L_FactNode[]) {
    super();
  }

  override toString() {
    return `${L_KW.Let} ${this.vars}: ${this.facts};`;
  }
}

export class LetFormalSymbolNode extends L_Node {
  constructor(public vars: string[], public facts: L_FactNode[]) {
    super();
  }

  override toString() {
    return `${L_KW.LetFormal} ${this.vars}: ${this.facts};`;
  }
}

export class ProveNode extends L_Node {
  constructor(public toProve: L_FactNode, public block: L_Node[]) {
    super();
  }

  override toString() {
    return `${L_KW.Prove} ${this.toProve}`;
  }
}
export class ProveContradictNode extends L_Node {
  constructor(
    public toProve: L_FactNode,
    public block: L_Node[],
    public contradict: OptFactNode
  ) {
    super();
  }

  override toString() {
    return `${L_KW.ProveByContradiction} ${this.toProve}`;
  }
}

export class LocalEnvNode extends L_Node {
  constructor(public nodes: L_Node[], public localEnv: L_Env) {
    super();
  }

  override toString() {
    return `{${this.nodes.map((e) => e.toString()).join("; ")}}`;
  }
}

export class HaveNode extends L_Node {
  constructor(public vars: L_Singleton[], public fact: OptFactNode) {
    super();
  }

  override toString() {
    return `${L_KW.Have} ${this.vars}: ${this.fact}`;
  }
}

export class DefOperatorNode extends L_Node {
  constructor(public composite: L_Composite, public facts: L_FactNode[]) {
    super();
  }

  toString(): string {
    return `${L_KW.DefOperator} ${this.composite}: ${this.facts}`;
  }
}

export class LetsNode extends L_Node {
  constructor(
    public name: string,
    public regex: RegExp,
    public facts: L_FactNode[]
  ) {
    super();
  }

  toString() {
    return `lets ${this.name} ${this.regex} : ${this.facts
      .map((e) => e.toString())
      .join(", ")}`;
  }
}

export class IncludeNode extends L_Node {
  constructor(public path: string) {
    super();
  }

  toString() {
    return `include "${this.path}";`;
  }
}

export class DefLiteralOptNode extends L_Node {
  constructor(
    public name: string,
    public vars: L_Symbol[],
    public facts: L_FactNode[],
    public path: string,
    public func: string
  ) {
    super();
  }
}

// export class DefFunctionalSymbolNode extends L_Node {
//   constructor(
//     public functional: FunctionalSymbol,
//     public facts: ToCheckNode[]
//   ) {
//     super();
//   }

//   toString(): string {
//     return `${L_Keywords.DefFunctional} ${this.functional}: ${this.facts}`;
//   }
// }

export class LetAliasNode extends L_Node {
  constructor(public name: L_Singleton, public toBeAliased: L_Symbol[]) {
    super();
  }

  toString() {
    return `${L_KW.LetAlias} ${this.name} ${this.toBeAliased}`;
  }
}

// The Followings are half implemented. --------------------------------------

export abstract class BuiltinCheckNode extends L_FactNode {}

// TODO IsProperty logic is not implemented
export class IsConceptNode extends BuiltinCheckNode {
  constructor(
    public concepts: L_Singleton[],
    public facts: L_FactNode[],
    isT: boolean
  ) {
    super(isT);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    throw Error();
  }

  override copyWithIsTReverse(): L_FactNode {
    return new IsConceptNode(this.concepts, this.facts, !this.isT);
  }

  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): L_FactNode {
    return this;
  }

  toString() {
    return `${L_KW.isConcept}(${this.concepts})`;
  }

  override tryFactVarsDeclared(env: L_Env): void {
    for (const fact of this.facts) {
      fact.tryFactVarsDeclared(env);
    }
  }
}

export class IsFormNode extends BuiltinCheckNode {
  constructor(
    public candidate: L_Symbol,
    public baseline: L_Composite,
    public facts: L_FactNode[],
    isT: boolean
  ) {
    super(isT);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    throw Error();
  }

  override copyWithIsTReverse(): L_FactNode {
    return new IsFormNode(this.candidate, this.baseline, this.facts, !this.isT);
  }

  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): L_FactNode {
    let fixed: L_Symbol | undefined = undefined;
    for (const freeFix of freeFixPairs) {
      if (L_Symbol.literallyIdentical(env, freeFix[0], this.candidate)) {
        fixed = freeFix[1];
      }
    }

    if (fixed === undefined) {
      env.report(`IsFormNode.fix failed`);
      throw Error();
    } else {
      return new IsFormNode(fixed, this.baseline, this.facts, this.isT);
    }
  }

  override tryFactVarsDeclared(env: L_Env): void {}

  toString(): string {
    const notStr = this.isT ? "" : "[not]";
    const mainStr = `${L_KW.isForm}(${this.candidate}, ${this.baseline}, {${this.facts}})`;
    return notStr + mainStr;
  }
}

export abstract class FormulaFactNode extends L_FactNode {
  constructor(
    public left: OptFactNode | FormulaFactNode,
    public right: OptFactNode | FormulaFactNode,
    isT: boolean
  ) {
    super(isT);
  }

  getWhereIsGivenFactAndAnotherBranch(fact: L_FactNode): {
    itself: FormulaSubNode;
    anotherBranch: FormulaSubNode;
  } {
    if (fact === this.left) {
      return { itself: this.left, anotherBranch: this.right };
    } else if (fact === this.right) {
      return { itself: this.right, anotherBranch: this.left };
    }

    throw Error();
  }

  override tryFactVarsDeclared(env: L_Env): void {
    this.left.tryFactVarsDeclared(env);
    this.right.tryFactVarsDeclared(env);
  }

  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): FormulaFactNode {
    const left = this.left.fixByIfVars(env, freeFixPairs);
    const right = this.right.fixByIfVars(env, freeFixPairs);
    if (this instanceof OrToCheckNode) {
      return new OrToCheckNode(left, right, this.isT);
    } else if (this instanceof AndToCheckNode) {
      return new AndToCheckNode(left, right, this.isT);
    }

    throw Error();
  }

  override copyWithIsTReverse(): L_FactNode {
    throw Error();
  }

  getLeftRight(): L_FactNode[] {
    return [this.left, this.right];
  }

  whereIsOpt(opt: OptFactNode) {
    const out = { left: false, right: false };
    if (this.left instanceof OptFactNode) {
      if (opt.optSymbol.name === this.left.optSymbol.name) {
        out.left = true;
      }
    } else if (this.left instanceof FormulaFactNode) {
      const got = this.left.whereIsOpt(opt);
      if (got.left || got.right) out.left = true;
    }

    if (this.right instanceof OptFactNode) {
      if (opt.optSymbol.name === this.right.optSymbol.name) {
        out.right = true;
      }
    } else if (this.right instanceof FormulaFactNode) {
      const got = this.right.whereIsOpt(opt);
      if (got.left || got.right) out.right = true;
    }

    return out;
  }
}

export class OrToCheckNode extends FormulaFactNode {
  override copyWithIsTReverse(): L_FactNode {
    return new OrToCheckNode(this.left, this.right, !this.isT);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    const out: [OptFactNode, L_FactNode[]][] = [];
    for (const node of this.getLeftRight()) {
      const roots = node.getRootOptNodes();
      for (const root of roots) {
        root[1] = [this, ...root[1]];
      }
      out.push(...roots);
    }
    return out;
  }

  toString() {
    return `(${this.left} or ${this.right})`;
  }

  getRootOpts(): OptFactNode[] | null {
    const allRoots: OptFactNode[] = [];
    for (const subNode of this.getLeftRight()) {
      if (subNode instanceof OrToCheckNode) {
        const roots = subNode.getRootOpts();
        if (roots === null) {
          return null;
        } else {
          allRoots.push(...roots);
        }
      } else if (subNode instanceof OptFactNode) {
        allRoots.push(subNode);
      } else {
        return null;
      }
    }

    return allRoots;
  }
}

export class AndToCheckNode extends FormulaFactNode {
  override copyWithIsTReverse(): L_FactNode {
    return new AndToCheckNode(this.left, this.right, !this.isT);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    const out: [OptFactNode, L_FactNode[]][] = [];
    for (const node of this.getLeftRight()) {
      const roots = node.getRootOptNodes();
      for (const root of roots) {
        root[1] = [this, ...root[1]];
      }
      out.push(...roots);
    }
    return out;
  }

  toString() {
    return `(${this.left} and ${this.right})`;
  }
}

export type FormulaSubNode = FormulaFactNode | OptFactNode;

export class FactsNode extends L_FactNode {
  constructor(
    public varsPairs: [L_Singleton, L_Symbol][][],
    public facts: L_FactNode[],
    isT: boolean
  ) {
    super(isT);
  }

  override tryFactVarsDeclared(env: L_Env): void {
    for (const v of this.varsPairs) {
      v.forEach((e) => e[1].tryVarsDeclared(env));
    }

    for (const fact of this.facts) {
      fact.tryFactVarsDeclared(env);
    }
  }

  override fixByIfVars(
    env: L_Env,
    freeFixPairs: [L_Symbol, L_Symbol][]
  ): L_FactNode {
    const newFixedVars: [L_Singleton, L_Symbol][][] = this.varsPairs.map((e) =>
      e.map((v: [L_Singleton, L_Symbol]) => [v[0], v[1].fix(env, freeFixPairs)])
    );

    const newFacts = this.facts.map((e) => e.fixByIfVars(env, freeFixPairs));

    return new FactsNode(newFixedVars, newFacts, this.isT);
  }

  override copyWithIsTReverse(): L_FactNode {
    return new FactsNode(this.varsPairs, this.facts, !this.isT);
  }

  override getRootOptNodes(): [OptFactNode, L_FactNode[]][] {
    throw Error();
  }

  toString() {
    const vars = this.varsPairs
      .map((arr) => arr.map((e) => `${e[0]}:${e[1]}`))
      .toString();
    return `[${vars}] {${this.facts}}`;
  }
}
