# Known Issues

## Authority and recovery limits

- A request that has not established a durable reservation can be known only to the original browser. Other devices cannot detect it automatically. The original browser must retain its pending command and recover it; database revisions prevent a stale overwrite if another device advances first. See [application flow](application-flow.md).
- The HTTP host releases settled idle sessions but retains those with unresolved recovery or required-refresh state. There is no admission limit or expiry policy for unresolved sessions, and receipts and fences have no pruning policy. Production operations and abuse limits remain to be designed. See [companySessions.ts](../../src/server/companySessions.ts).
