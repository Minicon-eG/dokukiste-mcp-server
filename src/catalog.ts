import { Ajv, type ValidateFunction } from 'ajv';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { problem, type Catalog, type JsonObject, type Operation } from './types.js';

export function operations(catalog: Catalog, allowWrites: boolean) {
  const visible = catalog.operations.filter(operation => allowWrites || operation.readOnly);
  const validators = new Map<string, ValidateFunction<JsonObject>>();
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true, formats: fullFormats });
  return Object.freeze({
    list: visible,
    find(id: string): Operation {
      const operation = visible.find(item => item.id === id);
      if (!operation) throw problem('OPERATION_UNAVAILABLE', 'Operation is unavailable in this product or write mode');
      return operation;
    },
    validate(operation: Operation, args: JsonObject): void {
      let validate = validators.get(operation.id);
      if (!validate) { validate = ajv.compile<JsonObject>(operation.inputSchema); validators.set(operation.id, validate); }
      if (!validate(args)) {
        const details = (validate.errors ?? []).map(error => `${error.instancePath || '/'}: ${error.message}`).join('; ');
        throw problem('INVALID_INPUT', `Invalid operation input: ${details}`);
      }
    },
  });
}
