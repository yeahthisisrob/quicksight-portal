# The promo video

Every screen in the promo is the portal itself, rendered from its Storybook stories over a made-up account
(`frontend/.storybook/mocks/account.ts`). Nothing in it comes from a real account.

- **Stills:** `frontend/scripts/promo-shots.mjs` opens each story, does what a person would do (sort, open a menu, pick a
  source, confirm) and takes a still after each step. Beside each still it writes where the pointer goes next and which
  rows to light up, as a manifest a video editor can animate over.

  ```
  just storybook
  node frontend/scripts/promo-shots.mjs <stills dir> <manifest.json>
  ```

- **Narration:** `narration.json` holds one line per scene and the written description the narrator's voice is made from.
  Any text-to-speech model that takes a voice description can speak it.

The edit (the frame, the pointer, the timing) is kept outside this repo.
