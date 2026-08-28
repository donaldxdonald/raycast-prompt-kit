const localStorageValues = new Map<string, string | number | boolean>();
const toasts: unknown[] = [];
let localStorageFailure: { operation: "setItem" | "removeItem"; keyPrefix: string } | undefined;

function failLocalStorageOperation(operation: "setItem" | "removeItem", key: string): void {
  if (localStorageFailure?.operation === operation && key.startsWith(localStorageFailure.keyPrefix)) {
    localStorageFailure = undefined;
    throw new Error(`LocalStorage ${operation} failed`);
  }
}

export const LocalStorage = {
  async allItems(): Promise<Record<string, string | number | boolean>> {
    return Object.fromEntries(localStorageValues);
  },
  async getItem<T>(key: string): Promise<T | undefined> {
    return localStorageValues.get(key) as T | undefined;
  },
  async setItem(key: string, value: string | number | boolean): Promise<void> {
    failLocalStorageOperation("setItem", key);
    localStorageValues.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    failLocalStorageOperation("removeItem", key);
    localStorageValues.delete(key);
  },
};

export const Toast = {
  Style: {
    Failure: "failure",
    Success: "success",
  },
};

export const Icon = {
  BarChart: "bar-chart-16",
  Bolt: "bolt-16",
  Book: "book-16",
  Calculator: "calculator-16",
  Calendar: "calendar-16",
  CheckList: "check-list-16",
  Clipboard: "copy-clipboard-16",
  Code: "code-16",
  Document: "blank-document-16",
  Envelope: "envelope-16",
  Globe: "globe-01-16",
  Image: "image-16",
  LightBulb: "light-bulb-16",
  MagnifyingGlass: "magnifying-glass-16",
  Message: "speech-bubble-16",
  Paragraph: "paragraph-16",
  Pencil: "pencil-16",
  Stars: "stars-16",
  Terminal: "terminal-16",
  Text: "text-16",
  Wand: "wand-16",
};

export async function showToast(options: unknown): Promise<void> {
  toasts.push(options);
}

export function __resetRaycast(): void {
  localStorageValues.clear();
  toasts.length = 0;
  localStorageFailure = undefined;
}

export function __setLocalStorage(key: string, value: string): void {
  localStorageValues.set(key, value);
}

export function __getToasts(): unknown[] {
  return [...toasts];
}

export function __failNextLocalStorageOperation(operation: "setItem" | "removeItem", keyPrefix: string): void {
  localStorageFailure = { operation, keyPrefix };
}
