# Known Issues

## Authority and recovery limits

- A request that has not established a durable reservation can be known only to the original browser. Other devices cannot detect it automatically. The original browser must retain its pending command and recover it; database revisions prevent a stale overwrite if another device advances first. See [application flow](application-flow.md).
- The HTTP host retains a session entry for every accessed owner/company for the life of the process, including resolved sessions; there is no eviction or admission limit. This needs bounded lifecycle and operational limits before exposing the candidate host to untrusted production traffic. See [server.ts](../../src/server/api/server.ts).
