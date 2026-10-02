import { describeStoreContract } from './store-contract';
import { MemoryStore } from './memory-store';

describeStoreContract('MemoryStore', async () => ({ store: new MemoryStore() }));
