import type { AfterModelCallback, LlmResponse } from '@google/adk';
import type { FunctionCall, Part } from '@google/genai';

export interface UnknownFunctionCallGuardOptions {
  allowedFunctionNames?: ReadonlyArray<string>;
  jsonFallbackFunctionNames?: ReadonlyArray<string>;
}

export function createUnknownFunctionCallGuard(options: UnknownFunctionCallGuardOptions = {}): AfterModelCallback {
  const allowed = new Set(options.allowedFunctionNames ?? []);
  const jsonFallbackNames = new Set(options.jsonFallbackFunctionNames ?? []);

  return ({ response }) => {
    return coerceUnknownFunctionCallsToText(response, allowed, jsonFallbackNames);
  };
}

export function coerceUnknownFunctionCallsToText(
  response: LlmResponse,
  allowedFunctionNames: ReadonlySet<string>,
  jsonFallbackFunctionNames: ReadonlySet<string> = new Set(),
): LlmResponse | undefined {
  const parts = response.content?.parts;
  if (!parts?.some((part) => isUnknownFunctionCall(part, allowedFunctionNames))) {
    return undefined;
  }

  return {
    ...response,
    content: {
      ...response.content,
      parts: parts.map((part) => {
        if (!isUnknownFunctionCall(part, allowedFunctionNames)) return part;
        return { text: stringifyUnknownFunctionCall(part.functionCall, jsonFallbackFunctionNames) };
      }),
    },
  };
}

function isUnknownFunctionCall(part: Part, allowedFunctionNames: ReadonlySet<string>): boolean {
  const name = part.functionCall?.name;
  return Boolean(name && !allowedFunctionNames.has(name));
}

function stringifyUnknownFunctionCall(
  functionCall: FunctionCall | undefined,
  jsonFallbackFunctionNames: ReadonlySet<string>,
): string {
  const name = functionCall?.name || 'unknown_function';
  const args = functionCall?.args ?? {};

  if (jsonFallbackFunctionNames.has(name)) {
    return JSON.stringify(args, null, 2);
  }

  return [
    `[ALEX] Modelo tentou chamar uma ferramenta nao registrada: ${name}.`,
    'Argumentos recebidos como texto:',
    JSON.stringify(args, null, 2),
  ].join('\n');
}
