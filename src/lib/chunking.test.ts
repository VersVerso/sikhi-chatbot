import test from "node:test";
import assert from "node:assert/strict";

import { buildChunksForPage } from "@/lib/chunking";

test("buildChunksForPage creates shabad-aware chunks", () => {
  const sample = `ਪਹਿਲੀ ਪੰਕਤੀ\nਦੂਜੀ ਪੰਕਤੀ ॥\nਤੀਜੀ ਪੰਕਤੀ\nਚੌਥੀ ਪੰਕਤੀ ॥`;

  const chunks = buildChunksForPage(sample, 12, 40, 5);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].page, 12);
  assert.equal(chunks[0].shabadHeuristicId, "p12-s0");
  assert.equal(chunks[1].shabadHeuristicId, "p12-s1");
  assert.match(chunks[0].text, /ਪਹਿਲੀ/);
});

test("buildChunksForPage applies overlap chunking on long segment", () => {
  const sample = `ਇਕ ਓਅੰਕਾਰ ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ ਅਕਾਲ ਮੂਰਤਿ ॥`;

  const chunks = buildChunksForPage(sample, 1, 20, 5);

  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[1].chunkIndex, 1);
});
