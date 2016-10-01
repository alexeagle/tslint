
import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "string-map-wrapper",
        description: "StringMapWrapper helper is being removed; inline usages",
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "maintainability",
        requiresTypeInfo: true,
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE = "inline usages of StringMapWrapper";

    public applyWithProgram(sourceFile: ts.SourceFile, ls: ts.LanguageService): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions(), ls.getProgram()));
    }
}

class Walker extends Lint.ProgramAwareRuleWalker {
    public visitCallExpression(node: ts.CallExpression) {
        try {
        // TODO: utility function isFunctionNamed("isBlank", "declaringModuleName");
        const tc = this.getTypeChecker();
        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propAccess = node.expression as ts.PropertyAccessExpression;
            let sym = tc.getSymbolAtLocation(propAccess.expression);
            // tslint:disable-next-line
            if (sym && sym.flags & ts.SymbolFlags.Alias) {
                sym = tc.getAliasedSymbol(sym);
            }
            if (sym && sym.name === "StringMapWrapper" &&
                    sym.getDeclarations()[0].getSourceFile().fileName.indexOf("facade/src/collection") >= 0) {
                // FIXME broken for nested calls, eg.
                // https://github.com/angular/angular/blob/756ef09d12b876cdc0fe21a03a8c24547db1522b/modules/@angular/compiler/src/animation/animation_compiler.ts#L299
                let replacements: Lint.Replacement[] = [this.deleteText(node.getStart(), node.getWidth())];
                const mapName = node.arguments[0];
                switch (propAccess.name.getText()) {
                    case "create":
                        replacements.push(this.appendText(node.getStart(), "{}"));
                        break;
                    case "contains":
                        const elementName = node.arguments[1];
                        replacements.push(this.appendText(node.getStart(),
                            `${mapName.getFullText()}.hasOwnProperty(${elementName.getFullText()})`));
                        break;
                    case "keys":
                        replacements.push(this.appendText(node.getStart(),
                            `Object.keys(${mapName.getFullText()})`));
                        break;
                    case "values":
                        replacements.push(this.appendText(node.getStart(),
                            `Object.keys(${mapName.getFullText()}).map(k => ${mapName.getText()}[k])`));
                        break;
                    case "isEmpty":
                        replacements.push(this.appendText(node.getStart(),
                            `Object.keys(${mapName.getFullText()}).length === 0`));
                        break;
                    case "merge":
                    case "equals":
                        // TODO
                        replacements = [];
                        break;
                    case "forEach":
                        const func = node.arguments[1] as ts.FunctionExpression;
                        let body = "";
                        if (func.body) {
                            if (func.body.statements) {
                            func.body.statements.forEach(s => body += s.getFullText());
                            } else {
                                body = func.body.getFullText();
                            }
                            const valName = func.parameters[0].name;
                            if (func.parameters.length > 1) {
                                const keyName = func.parameters[1].name;
                                replacements.push(this.appendText(node.getStart(),
                                    `Object.keys(${mapName.getFullText()}).` +
                                    `forEach(${keyName.getFullText()} => {` +
                                    ` const ${valName.getFullText()} = ${mapName.getText()}[${keyName.getText()}]; ${body} ` +
                                    `})`));
                            } else {
                                replacements.push(this.appendText(node.getStart(),
                                    `Object.keys(${mapName.getFullText()}).` +
                                    `forEach(k => {` +
                                    ` const ${valName.getFullText()} = ${mapName.getText()}[k]; ${body} ` +
                                    `})`));
                            }
                        } else {
                            replacements.push(this.appendText(node.getStart(),
                                `"/* FIXME\n${node.getFullText()}\n*/`));
                        }
                        break;
                    default:
                        throw new Error("don't have a case for " + propAccess.name.getText());
                }
                this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE,
                    new Lint.Fix("string-map-wrapper", replacements)));
            }
        }
        } catch (e) {
            console.error(this.getSourceFile().fileName + " -> " + node.getFullText());
            throw e;
        }
        super.visitCallExpression(node);
    }
}
