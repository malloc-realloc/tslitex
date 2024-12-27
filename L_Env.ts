import { L_ReportBoolErr, L_ReportErr } from "./L_Report";
import * as L_Nodes from "./L_Nodes";
import * as L_Structs from "./L_Structs";

export class L_Env {
  private parent: L_Env | undefined = undefined;
  private messages: string[] = [];
  private pureSingletons = new Set<string>();
  private defs = new Map<string, L_Nodes.DefNode>();
  private facts = new Map<string, L_Structs.L_KnownFactReq[]>();
  private composites = new Map<string, L_Nodes.DefCompositeNode>();
  private regexSingletons = new Map<string, L_Nodes.LetsNode>();
  private macros = new Map<string, L_Nodes.MacroNode>();
  private includes: string[] = [];
  private literalOperators = new Map<string, L_Nodes.DefLiteralOptNode>();

  // TODO
  private aliases = new Map<string, L_Structs.L_Symbol>();
  private formalSymbols = new Set<string>();
  private functionalSymbols = new Map<string, L_Nodes.DefFunctionalNode>();

  constructor(parent: L_Env | undefined = undefined) {
    this.parent = parent;
  }

  newLiteralOpt(node: L_Nodes.DefLiteralOptNode): boolean {
    if (this.getLiteralOpt(node.name)) {
      return L_ReportBoolErr(
        this,
        this.newLiteralOpt,
        `The literal operator ${node.name} is already declared.`
      );
    } else {
      this.literalOperators.set(node.name, node);
      return true;
    }
  }

  getLiteralOpt(key: string): undefined | L_Nodes.DefLiteralOptNode {
    const out = this.literalOperators.get(key);
    if (out !== undefined) {
      return out;
    } else {
      if (this.parent !== undefined) {
        return this.parent.getLiteralOpt(key);
      } else {
        return undefined;
      }
    }
  }

  newCompositeVar(key: string, fact: L_Nodes.DefCompositeNode): boolean {
    if (this.getCompositeVar(key)) {
      return L_ReportBoolErr(
        this,
        this.newCompositeVar,
        `The variable "${key}" is already declared in this environment or its parent environments. Please use a different name.`
      );
    } else {
      this.composites.set(key, fact);
      return true;
    }
  }

  getCompositeVar(key: string): undefined | L_Nodes.DefCompositeNode {
    const out = this.composites.get(key);
    if (out !== undefined) {
      return out;
    } else {
      if (this.parent !== undefined) {
        return this.parent.getCompositeVar(key);
      } else {
        return undefined;
      }
    }
  }

  newFact(key: string, fact: L_Structs.L_KnownFactReq): boolean {
    if (this.facts.get(key) === undefined) {
      this.facts.set(key, [fact]);
    } else {
      this.facts.get(key)?.push(fact);
    }
    return true;
  }

  getFacts(key: string): undefined | L_Structs.L_KnownFactReq[] {
    let currentFacts = this.facts.get(key);

    if (currentFacts === undefined) {
      if (this.parent !== undefined) {
        return this.parent.getFacts(key);
      } else {
        return undefined;
      }
    } else {
      const fromParent = this.parent?.getFacts(key);
      if (fromParent === undefined) {
        return currentFacts;
      } else {
        return [...currentFacts, ...fromParent];
      }
    }
  }

  clear() {
    this.parent = undefined;
    this.messages = [];
    this.pureSingletons = new Set<string>();
    this.regexSingletons = new Map<string, L_Nodes.LetsNode>();
    this.defs = new Map<string, L_Nodes.DefNode>();
  }

  // used by checker and executor
  subFactsDeclaredOrBuiltin(node: L_Nodes.ToCheckNode): boolean {
    if (node instanceof L_Nodes.OptNode) {
      return (
        this.getDef(node.optSymbol.name) !== undefined ||
        node instanceof L_Nodes.BuiltinCheckNode
      );
    } else if (node instanceof L_Nodes.LogicNode) {
      return (
        node.req.every((e) => this.subFactsDeclaredOrBuiltin(e)) &&
        node.onlyIfs.every((e) => this.subFactsDeclaredOrBuiltin(e))
      );
    } else if (node instanceof L_Nodes.BuiltinCheckNode) {
      return true;
    } else if (node instanceof L_Nodes.ToCheckFormulaNode) {
      return (
        this.subFactsDeclaredOrBuiltin(node.left) &&
        this.subFactsDeclaredOrBuiltin(node.right)
      );
    }

    return false;
  }

  getDef(s: string): L_Nodes.DefNode | undefined {
    if (this.defs.has(s)) {
      return this.defs.get(s);
    } else if (this.parent) {
      return this.parent.getDef(s);
    } else {
      return undefined;
    }
  }

  // getDefExist(s: string): L_Nodes.DefExistNode | undefined {
  //   if (this.defExists.has(s)) {
  //     return this.defExists.get(s);
  //   } else if (this.parent) {
  //     return this.parent.getDefExist(s);
  //   } else {
  //     return undefined;
  //   }
  // }

  newDef(s: string, defNode: L_Nodes.DefNode): boolean {
    // REMARK: YOU ARE NOT ALLOWED TO DECLARE A FACT TWICE AT THE SAME ENV.
    if (this.getDef(s) !== undefined) {
      return L_ReportBoolErr(
        this,
        this.newDef,
        `The operator "${s}" is already declared in this environment or its parent environments. Please use a different name.`
      );
    }

    this.defs.set(s, defNode);
    this.report(`[def] ${defNode}`);
    return true;
  }

  // newExistDef(s: string, defNode: L_Nodes.DefExistNode): boolean {
  //   if (this.getDefExist(s) !== undefined) {
  //     return L_ReportBoolErr(
  //       this,
  //       this.newExistDef,
  //       `The exist-type operator "${s}" is already declared in this environment or its parent environments. Please use a different name.`
  //     );
  //   }

  //   this.defExists.set(s, defNode);
  //   this.report(`[def_exist] ${defNode}`);
  //   return true;
  // }

  newLetsSymbol(letsNode: L_Nodes.LetsNode) {
    if (this.isSingletonDeclared(letsNode.name)) {
      return L_ReportBoolErr(
        this,
        this.newLetsSymbol,
        `letsVar ${letsNode.name} already declared`
      );
    }
    this.regexSingletons.set(letsNode.name, letsNode);
  }

  newLetSymbol(fix: string): boolean {
    // TO MAKE MY LIFE EASIER SO THAT I DO NOT NEED TO BIND ENV TO VARIABLE, I forbid redefining a variable with the same name with any visible variable.
    if (this.isSingletonDeclared(fix)) {
      return L_ReportBoolErr(
        this,
        this.newLetSymbol,
        `The variable "${fix}" is already declared in this environment or its parent environments. Please use a different name.`
      );
    }
    this.pureSingletons.add(fix);
    return true;
  }

  newLetFormalSymbol(fix: string): boolean {
    // TO MAKE MY LIFE EASIER SO THAT I DO NOT NEED TO BIND ENV TO VARIABLE, I forbid redefining a variable with the same name with any visible variable.
    if (this.isSingletonDeclared(fix)) {
      return L_ReportBoolErr(
        this,
        this.newLetFormalSymbol,
        `The variable "${fix}" is already declared in this environment or its parent environments. Please use a different name.`
      );
    }
    this.formalSymbols.add(fix);
    return true;
  }

  newAlias(
    name: L_Structs.L_Singleton,
    toBeAliased: L_Structs.L_Symbol
  ): boolean {
    if (this.isSingletonDeclared(name.value)) {
      return L_ReportBoolErr(
        this,
        this.newAlias,
        `The variable "${name.value}" is already declared in this environment or its parent environments. Please use a different name.`
      );
    }
    this.aliases.set(name.value, toBeAliased);
    return true;
  }

  getAlias(name: string): L_Structs.L_Symbol | undefined {
    const out = this.aliases.get(name);
    if (out === undefined) {
      if (this.parent !== undefined) {
        return this.parent.getAlias(name);
      } else {
        return undefined;
      }
    } else {
      return out;
    }
  }

  //* A VERY IMPORTANT FUNCTION. IT GUARANTEES SAFETY.
  isSingletonDeclared(fix: string): boolean {
    return (
      this.isPureSingletonDeclared(fix) ||
      this.isRegexSingleton(fix) ||
      this.isFormalSymbolDeclared(fix) ||
      this.isAliasDeclared(fix)
    );
  }

  isAliasDeclared(name: string): boolean {
    if (this.getAlias(name) !== undefined) {
      return true;
    } else {
      if (!this.parent) return false;
      else return this.parent.isAliasDeclared(name);
    }
  }

  // two ways of checking : 1. it's letsVar name 2. it satisfies regex of a var
  isRegexSingleton(varStr: string): boolean {
    if (this.regexSingletons.has(varStr)) {
      return true;
    }

    for (const knownLet of this.regexSingletons.values()) {
      if (knownLet.regex.test(varStr)) return true;
    }

    if (this.parent !== undefined) {
      return this.parent.isRegexSingleton(varStr);
    } else return false;
  }

  isFormalSymbolDeclared(key: string): boolean {
    if (this.formalSymbols.has(key)) {
      return true;
    } else {
      if (!this.parent) return false;
      else return this.parent.isFormalSymbolDeclared(key);
    }
  }

  isPureSingletonDeclared(key: string): boolean {
    if (this.pureSingletons.has(key)) {
      return true;
    } else {
      if (!this.parent) return false;
      else return this.parent.isPureSingletonDeclared(key);
    }
  }

  optDeclared(key: string): boolean {
    if (this.defs.get(key)) {
      return true;
    } else {
      if (!this.parent) return false;
      else return this.parent.optDeclared(key);
    }
  }

  getMessages() {
    return this.messages;
  }

  report(s: string): L_Structs.L_Out {
    this.messages.push(s);
    return L_Structs.L_Out.True;
  }

  printClearMessage() {
    this.messages.forEach((m) => console.log(m));
    this.messages = [];
  }

  clearMessages() {
    this.messages = [];
  }

  OKMesReturnL_Out(message: L_Nodes.L_Node | string): L_Structs.L_Out {
    if (message instanceof L_Nodes.L_Node) this.report(`OK! ${message}`);
    else this.report(message);
    return L_Structs.L_Out.True;
  }

  OKMesReturnBoolean(message: L_Nodes.L_Node | string): boolean {
    if (message instanceof L_Nodes.L_Node) this.report(`OK! ${message}`);
    else this.report(message);
    return true;
  }

  errMesReturnL_Out(s: L_Nodes.L_Node | string): L_Structs.L_Out {
    this.report(`Error: ${s}`);
    return L_Structs.L_Out.Error;
  }

  errMesReturnBoolean(s: L_Nodes.L_Node | string): boolean {
    this.report(`Error: ${s}`);
    return false;
  }

  printDeclFacts() {
    console.log("\n--Declared Facts--\n");

    for (const [name, declFact] of this.defs) {
      console.log(name);
      console.log(declFact);
    }
  }

  toJSON() {
    return {
      vars: Array.from(this.pureSingletons),
      defs: Object.fromEntries(this.defs),
      facts: Object.fromEntries(this.facts),
    };
  }

  getLetsVar(varStr: string): L_Nodes.LetsNode | undefined {
    if (this.isRegexSingleton(varStr)) {
      const out = this.regexSingletons.get(varStr);
      if (out !== undefined) {
        return out;
      } else {
        for (const knownLet of this.regexSingletons.values()) {
          if (knownLet.regex.test(varStr)) return knownLet;
        }

        if (this.parent !== undefined) {
          return this.parent.getLetsVar(varStr);
        } else return undefined;
      }
    }

    return undefined;
  }

  newMacro(macro: L_Nodes.MacroNode): boolean {
    if (this.getMacro(macro.name) !== undefined) {
      return L_ReportBoolErr(
        this,
        this.newMacro,
        `macro ${macro.name} is already declared.`
      );
    }
    this.macros.set(macro.name, macro);
    return true;
  }

  getMacro(name: string): L_Nodes.MacroNode | undefined {
    if (this.macros.has(name)) {
      return this.macros.get(name);
    }

    if (this.parent !== undefined) {
      return this.parent.getMacro(name);
    } else return undefined;
  }

  newInclude(path: string) {
    if (!this.isLibPathIncluded(path)) {
      this.includes.push(path);
      return true;
    } else {
      return L_ReportBoolErr(
        this,
        this.newInclude,
        `${path} is already included`
      );
    }
  }

  getIncludes(): string[] {
    if (this.parent === undefined) {
      return this.includes;
    } else {
      return [...this.parent.getIncludes(), ...this.includes];
    }
  }

  isLibPathIncluded(path: string): boolean {
    if (this.getIncludes().some((e) => e === path)) return true;
    else return false;
  }
}
