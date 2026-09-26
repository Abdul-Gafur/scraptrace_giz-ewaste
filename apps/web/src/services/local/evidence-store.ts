/**
 * Photographs captured in the browser. They are far larger than the rest of the programme
 * state, so they live in IndexedDB rather than `localStorage`, keyed by evidence id.
 *
 * Environments without IndexedDB (server rendering, jsdom in unit tests) fall back to an
 * in-memory map: evidence then lasts for the session only, which is correct for those.
 */

const DATABASE_NAME = "scraptrace-evidence";
const STORE_NAME = "evidence";
const memory = new Map<string, string>();

const hasIndexedDb = (): boolean => typeof indexedDB !== "undefined";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Evidence storage is unavailable."));
  });

const withStore = async <Result>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> => {
  const database = await openDatabase();
  try {
    return await new Promise<Result>((resolve, reject) => {
      const request = run(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Evidence storage failed."));
    });
  } finally {
    database.close();
  }
};

export const putEvidence = async (evidenceId: string, dataUrl: string): Promise<void> => {
  if (!hasIndexedDb()) {
    memory.set(evidenceId, dataUrl);
    return;
  }
  await withStore("readwrite", (store) => store.put(dataUrl, evidenceId));
};

export const getEvidence = async (evidenceId: string): Promise<string | null> => {
  if (!hasIndexedDb()) return memory.get(evidenceId) ?? null;
  const stored = await withStore<string | undefined>("readonly", (store) => store.get(evidenceId));
  return stored ?? null;
};

export const countEvidence = async (): Promise<number> => {
  if (!hasIndexedDb()) return memory.size;
  return withStore<number>("readonly", (store) => store.count());
};

export const clearEvidence = async (): Promise<void> => {
  memory.clear();
  if (!hasIndexedDb()) return;
  await withStore("readwrite", (store) => store.clear());
};

/**
 * Downscales a captured photograph before it is stored. Field devices produce multi-megabyte
 * images; the programme only needs enough detail to recognise the item and the damage.
 */
export const toStoredImage = (file: File, maxEdge = 720): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The photograph could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The photograph could not be decoded."));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(String(reader.result));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
