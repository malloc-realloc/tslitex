import { CallOptNode, InferNode } from "./ast";

type SnapShot = { fatherFreeVars: string[][] };

export class LiTeXEnv {
  errors: string[] = [];
  infers: Map<string, InferNode> = new Map<string, InferNode>();
  //! string[] will be symbols[] because $$
  callOptFacts: Map<string, string[][][]> = new Map<string, string[][][]>();
  fatherFreeVars: string[][] = [];

  returnToSnapShot(original: SnapShot) {
    this.fatherFreeVars = original.fatherFreeVars;
  }

  getSnapShot(): SnapShot {
    return { fatherFreeVars: [...this.fatherFreeVars] };
  }

  constructor() {}

  pushErrorMessage(s: string) {
    this.errors.push(s);
  }

  keyInDefs(s: string) {
    return this.infers.has(s);
  }

  callOptNodeName(optNode: CallOptNode) {
    return optNode.optName;
  }

  getFromCallOptFacts(optNode: CallOptNode) {
    const optName: string = optNode.optName;
    const validParamsLst = this.callOptFacts.get(optName);
    return validParamsLst;
  }

  newFact(node: CallOptNode) {
    // check whether it's truly a new fact
    if (this.isCallOptFact(node)) {
      return;
    } else {
      if (!this.getFromCallOptFacts(node)) {
        this.callOptFacts.set(this.callOptNodeName(node), [node.optParams]);
      } else {
        this.callOptFacts.get(this.callOptNodeName(node))?.push(node.optParams);
      }
    }
  }

  isCallOptFact(optNode: CallOptNode): Boolean {
    function paramsIsValid(lst1: string[], lst2: string[]): Boolean {
      if (lst1.length !== lst2.length) {
        return false;
      }
      for (let i = 0; i < lst1.length; i++) {
        // The reason why [0] exists in lst1[i][0] is that user sometimes want to specify sequence of given parameter
        if (lst1[i] !== lst2[i] && lst1[i][0] !== "#") {
          return false;
        }
      }
      return true;
    }

    const validParamsLst = this.getFromCallOptFacts(optNode);
    if (!validParamsLst) return false;

    for (const item of validParamsLst) {
      let sig = true;
      for (let i = 0; i < item.length; i++) {
        if (!paramsIsValid(item[i], optNode.optParams[i])) {
          sig = false;
          break;
        }
      }
      if (sig) return true;
    }

    return false;
  }

  printCallOptFacts() {
    for (const [key, value] of this.callOptFacts) {
      console.log(key);
      for (const item of value) {
        console.log(item);
        console.log("----callOpt------");
      }
    }
  }

  printInfers() {
    for (const [key, value] of this.infers) {
      console.log(key);
      console.log(value.params);
      for (const item of value.requirements) {
        console.log(item);
      }
      for (const item of value.onlyIfExprs) {
        console.log(item);
      }
      console.log("------infer-------");
    }
  }
}

function strLstEql(lst1: string[], lst2: string[]): Boolean {
  if (lst1.length !== lst2.length) {
    return false;
  }
  for (let i = 0; i < lst1.length; i++) {
    if (lst1[i] !== lst2[i]) {
      return false;
    }
  }
  return true;
}
