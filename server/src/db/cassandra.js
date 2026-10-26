import cassandra from 'cassandra-driver';
import { config } from '../config.js';

let client;

// The driver connects lazily on the first execute(); always pass { prepare: true }.
export function getCassandra() {
  client ??= new cassandra.Client(config.cassandra);
  return client;
}

export async function closeCassandra() {
  if (client) await client.shutdown();
}

export const { types } = cassandra;
