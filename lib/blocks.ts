"use server";

import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Index } from "@/__registry__";
import { Project, ScriptKind, SourceFile, SyntaxKind } from "ts-morph";
import { z } from "zod";
import { Style } from "@/registry/styles";
import {
  BlockChunk,
  blockSchema,
  registryEntrySchema,
} from "@/registry/schema";

const DEFAULT_BLOCKS_STYLE = "default" satisfies Style["name"];

const project = new Project({
  compilerOptions: {},
});

async function _getBlockCode(
  name: string,
  style: Style["name"] = DEFAULT_BLOCKS_STYLE
) {
  const entry = Index[style][name];
  const block = registryEntrySchema.parse(entry);

  if (!block.source) {
    return "";
  }

  return await readFile(block.source);
}

async function readFile(source: string) {
  const filepath = path.join(process.cwd(), source);
  return await fs.readFile(filepath, "utf-8");
}

async function createTempSourceFile(filename: string) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "codex-"));
  return path.join(dir, filename);
}

async function _getBlockContent(name: string, style: Style["name"]) {
  console.log("inside _getBlockContent, name:", name, "style:", style);
  const raw = await _getBlockCode(name, style);

  console.log("raw variable");

  const tempFile = await createTempSourceFile(`${name}.tsx`);
  console.log("tempFile successfully created");
  const sourceFile = project.createSourceFile(tempFile, raw, {
    scriptKind: ScriptKind.TSX,
  });
  console.log("successfully created sourceFile", sourceFile);

  // Extract meta.
  const description = _extractVariable(sourceFile, "description");
  const iframeHeight = _extractVariable(sourceFile, "iframeHeight");
  const containerClassName = _extractVariable(sourceFile, "containerClassName");

  console.log("Extracted meta:")
  console.log("description***", description)
  console.log("iframeHeight***", iframeHeight)
  console.log("containerClassName***", containerClassName)

  // Format the code.
  let code = sourceFile.getText();
  code = code.replaceAll(`@/registry/${style}/`, "@/components/");
  code = code.replaceAll("export default", "export");
  console.log("code***", code)

  return {
    description,
    code,
    container: {
      height: iframeHeight,
      className: containerClassName,
    },
  };
}

function _extractVariable(sourceFile: SourceFile, name: string) {
  const variable = sourceFile.getVariableDeclaration(name);
  if (!variable) {
    return null;
  }

  const value = variable
    .getInitializerIfKindOrThrow(SyntaxKind.StringLiteral)
    .getLiteralValue();

  variable.remove();

  return value;
}

export { _getBlockContent };
