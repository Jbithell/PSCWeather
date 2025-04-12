import { DefaultLogger, type LogWriter } from "drizzle-orm";

class DrizzleLogger implements LogWriter {
  write(message: string): void {
    console.log({ message });
  }
}

export const drizzleLogger = new DefaultLogger({ writer: new DrizzleLogger() });
