import * as core from "@actions/core";
import * as E from "effect/Effect";

// State

export const saveState = (name: string, value: string) => E.sync(() => core.saveState(name, value));
export const getState = (name: string) => E.sync(() => core.getState(name));

// Inputs
export const getInput = (name: string, options?: core.InputOptions) =>
  E.sync(() => core.getInput(name, options));

export const getBooleanInput = (name: string, options?: core.InputOptions) =>
  E.sync(() => core.getBooleanInput(name, options));

export const getPositiveNumber = (input: string, options?: core.InputOptions) =>
  E.sync(() => {
    const value = core.getInput(input, options);
    const number = parseFloat(value);
    if (Number.isNaN(number) || number <= 0) {
      throw new Error(`Invalid ${input}: ${value}`);
    }
    return number;
  });

export const getCommaSeparatedWords = (
  input: string,
  options?: core.InputOptions & { trimWhitespace?: boolean; dropEmpty?: boolean },
) =>
  E.sync(() => {
    const trim = options?.trimWhitespace ?? true;
    const dropEmpty = options?.dropEmpty ?? true;
    return core
      .getInput(input, options)
      .split(",")
      .map((w) => (trim ? w.trim() : w))
      .filter((w) => (dropEmpty ? w.length > 0 : true));
  });

// Outputs
export const setOutput = (name: string, value: string) => E.sync(() => core.setOutput(name, value));
export const setFailed = (message: string) => E.sync(() => core.setFailed(message));

// Logs
export const debug = (message: string) => E.sync(() => core.debug(message));
export const info = (message: string) => E.sync(() => core.info(message));
export const error = (message: string) => E.sync(() => core.error(message));
