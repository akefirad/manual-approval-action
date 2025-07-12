import * as core from "@actions/core";

export interface TimeoutHandle {
  cancel: () => void;
}

export class TimeoutManager {
  private timeoutId: NodeJS.Timeout | null = null;

  createTimeout(seconds: number, onTimeout: () => void): TimeoutHandle {
    core.debug(`Creating timeout: ${seconds} seconds`);
    this.cancel();

    this.timeoutId = setTimeout(() => {
      core.debug(`Timeout triggered after ${seconds} seconds`);
      this.timeoutId = null;
      onTimeout();
    }, seconds * 1000);

    return {
      cancel: () => this.cancel(),
    };
  }

  cancel(): void {
    if (this.timeoutId) {
      core.debug("Canceling timeout");
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
