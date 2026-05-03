import type { SaveSlot, SaveData, PlayerState, GameState } from '../types';
import type { StateManager } from './StateManager';

const DB_NAME = 'sannianyou_save';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_VERSION = '0.1.0';

/**
 * SaveManager — IndexedDB-first, localStorage fallback.
 * Decoupled from Phaser: takes StateManager instead of accessing window.phaserGame.
 * Supports multi-slot saves, auto-save, and slot listing.
 */
export class SaveManager {
  private db: IDBDatabase | null = null;
  private useLocalStorage = false;
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  async init(): Promise<void> {
    try {
      this.db = await this.openDB();
    } catch {
      this.useLocalStorage = true;
    }
  }

  async save(slot: number): Promise<void> {
    const player = this.stateManager.getPlayerState();
    const gameState = this.stateManager.getGameState();

    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: new Date().toISOString(),
      player,
      game: gameState,
      settings: {},
    };

    if (this.useLocalStorage || !this.db) {
      this.saveLocalStorage(slot, data);
    } else {
      await this.saveIndexedDB(slot, data);
    }
  }

  async load(slot: number): Promise<SaveData | null> {
    if (this.useLocalStorage || !this.db) {
      return this.loadLocalStorage(slot);
    }
    return this.loadIndexedDB(slot);
  }

  async listSlots(): Promise<SaveSlot[]> {
    const slots: SaveSlot[] = [];
    for (let i = 0; i <= 2; i++) {
      const data = await this.load(i);
      slots.push({
        slot: i,
        timestamp: data?.timestamp ?? null,
        summary: data?.player?.rank ?? null,
      });
    }
    return slots;
  }

  async delete(slot: number): Promise<void> {
    if (this.useLocalStorage || !this.db) {
      localStorage.removeItem(`3yy_save_${slot}`);
    } else {
      await this.deleteIndexedDB(slot);
    }
  }

  async autoSave(): Promise<void> {
    await this.save(0);
  }

  // -- IndexedDB internal methods --

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'slot' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private saveIndexedDB(slot: number, data: SaveData): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ slot, ...data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private loadIndexedDB(slot: number): Promise<SaveData | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(slot);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) return resolve(null);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slot: _slot, ...data } = result;
        resolve(data as SaveData);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private deleteIndexedDB(slot: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // -- localStorage internal methods --

  private saveLocalStorage(slot: number, data: SaveData): void {
    localStorage.setItem(`3yy_save_${slot}`, JSON.stringify(data));
  }

  private loadLocalStorage(slot: number): SaveData | null {
    const raw = localStorage.getItem(`3yy_save_${slot}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  }
}
