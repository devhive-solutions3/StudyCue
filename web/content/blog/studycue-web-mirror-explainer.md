---
title: 'StudyCue mirror sync in plain English'
description: 'What Firebase stores vs what stays on-phone.'
date: 2026-02-12
---

The Expo app owns SQLite offline. Opted-in mirrors serialize classes, categories, tasks, sessions, and key preferences into a single Firestore document per account.

Conflict handling is intentional last-write-wins for solo students—advanced merging can land later.

The Next.js `/app` area reads that same blob so planners can pivot between phone and laptop without juggling exports.
