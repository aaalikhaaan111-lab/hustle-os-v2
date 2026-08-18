# Coming Soon (Telegram / WhatsApp) — media brief

The messenger section is the one forward-looking claim on the landing page. It
is labelled **Coming**, and its copy states in both languages that messenger
access is not available yet. Any asset produced from this brief must keep that
true: it shows what Ventrio is building, never a shipped feature.

**Hard constraints for whoever generates these.**

- No Telegram or WhatsApp logos, wordmarks, brand blues/greens, or UI
  chrome copied from either app. Use a neutral messenger *shape* only. Using
  their marks would claim a partnership that does not exist and is a trademark
  problem besides.
- No fabricated metrics, no "1,200 sites updated", no notification counts.
- No stock-looking people, no desks with coffee, no glowing AI orbs, no
  neural-network filigree. The page is warm-neutral and quiet; an asset that
  looks like generic AI marketing will look wrong next to it.
- Text inside the frame must be legible and real English or Russian. Generated
  gibberish text is the single fastest way to make this look fake.

**Placement.** Right column of the messenger section, same rounded panel and
1px border as the after-launch stage. Aspect 4:3 on desktop, 1:1 on narrow.

---

## Option A — motion, 6–8 seconds

Silent, looping, no captions. It must read with sound off and at thumbnail
size.

**Beat sheet**

| Time | What happens |
| --- | --- |
| 0.0–1.2s | A phone-shaped frame, warm off-white, empty thread. |
| 1.2–2.6s | A short outgoing message types in on the right: `change the price to £8`. |
| 2.6–3.4s | A small "typing" indicator on the left. |
| 3.4–4.6s | A reply arrives: `Updated — the live page shows £8.` |
| 4.6–6.4s | The frame splits: the thread slides left, a web page slides in on the right, and the price on that page changes from £10 to £8 in place. |
| 6.4–8.0s | Both settle. A small caption chip reads **Coming soon**. Hold, then loop. |

**Generation prompt (video)**

> A silent 8-second product animation on a warm off-white background (#FBFAF8).
> A single rounded phone-shaped chat frame, thin 1px warm-grey border, soft
> shadow, no device bezel and no brand logos. A short message bubble types in
> on the right reading "change the price to £8", then a small three-dot typing
> indicator appears on the left, then a reply bubble reads "Updated — the live
> page shows £8." The frame then splits horizontally: the chat slides to the
> left half and a simple web page mock slides into the right half, where a
> price label animates from "£10" to "£8". Everything settles and a small
> rounded chip reading "Coming soon" fades in at the bottom. Minimal flat
> vector style, no gradients, no glow, no people, no logos, no camera motion,
> no text other than the words specified. Calm easing, nothing bounces. Loops
> seamlessly.

**Negative prompt:** `logos, Telegram, WhatsApp, brand colors, glowing orbs,
neural network graphics, 3D render, lens flare, people, hands, desk, coffee,
gibberish text, watermark, UI clutter, notification badges, fake statistics`

**Specs:** MP4 (H.264) + WebM (VP9), 1600×1200, 30fps, ≤1.5 MB, no audio track.
Ship with `autoplay muted loop playsinline` and a `poster` set to Option B.
Must be omitted entirely under `prefers-reduced-motion: reduce` — render the
still instead.

---

## Option B — still image fallback

The final frame of the motion, at rest: chat on the left showing both messages,
page on the right showing £8, "Coming soon" chip present.

**Generation prompt (image)**

> A flat vector product illustration on a warm off-white background (#FBFAF8).
> Left half: a rounded chat panel with a thin 1px warm-grey border containing
> two message bubbles — a right-aligned one reading "change the price to £8" in
> light grey, and a left-aligned one reading "Updated — the live page shows £8."
> Right half: a simplified web page mock with a headline bar, a small image
> block and a visible price reading "£8". A small rounded chip at the bottom
> reads "Coming soon". Minimal, calm, no gradients, no glow, no logos, no
> people, no device bezels. Muted warm neutrals with one restrained violet
> accent (#5a51e8) used only on a single small element.

**Negative prompt:** same list as Option A.

**Specs:** WebP + PNG fallback, 1600×1200, ≤180 KB, `loading="lazy"`,
`alt` describing the scene rather than the feature.

---

## Not commissioned yet

Neither asset is in the repository. The section currently ships with the live
messenger demo in the after-launch stage — real HTML, labelled as not yet
available — which is honest and costs nothing. These prompts exist so the media
can be produced without re-deciding the constraints.
