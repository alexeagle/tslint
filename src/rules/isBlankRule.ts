import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "is-blank",
        description: "isBlank helper is being removed; inline usages",
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "maintainability",
        requiresTypeInfo: true,
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE = "inline usages of isBlank";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions(), program));
    }
}

class Walker extends Lint.ProgramAwareRuleWalker {
    public visitCallExpression(node: ts.CallExpression) {
        // TODO: utility function isFunctionNamed("isBlank");
        const tc = this.getTypeChecker();
        const sym = tc.getSymbolAtLocation(node.expression);
        if (sym.name === "isBlank") {
            // TODO: utility function typeOfArg(0)
            const arg0 = node.arguments[0];
            const arg0Type = tc.getTypeAtLocation(arg0);
            // tslint:disable-next-line
            if (arg0Type.getFlags() & ts.TypeFlags.ObjectType) {
                // TODO: utility function exprNeedsParens
              const parens = arg0.hasOwnProperty("operatorToken"); // instanceOf ts.BinaryExpression
              const replacements = [
                this.deleteText(node.getStart(), "isBlank".length + (parens ? 0 : 1)),
                this.deleteText(node.getEnd() - 1, parens ? 0 : 1),
              ];
              const booleanContext = node.parent.kind === ts.SyntaxKind.IfStatement;
              if (!booleanContext) {
                  replacements.push(this.appendText(node.getStart(), "!!"));
              }
              this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE, new Lint.Fix("is-blank", replacements)));
            }
        }
        super.visitCallExpression(node);
    }
}
