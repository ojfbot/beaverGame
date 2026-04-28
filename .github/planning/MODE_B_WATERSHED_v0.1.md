# Cozy Beaver — Mode B: *The Watershed* (Planning v0.1)

*Slow-sim sandbox. Cartoon-real. Twilight-driven. The pond grows until the cul-de-sacs go under.*

---

## 1. Premise

A Master Planned Community — call it Willow Bend — was platted on top of a wetland a decade before the game starts. The pond from Mode A is what's left of that wetland. The beaver colony has been building, quietly, for a while. The water is starting to find its old paths.

The player works in **twilight windows** (dawn and dusk, ~20 minutes of real time each, 1–2 in-game hours). During the day the world advances on its own — humans react, blockages get cleared, news happens. At night the world is dark and the player rests. The cycle is the metronome of the game.

**Tone.** Not satirical, not vengeful. Cartoon-real, melancholic-funny, the register of *Untitled Goose Game* crossed with *A Short Hike*. The residents aren't villains. The HOA president is a person, not a punchline. Nature reasserts; people improvise; the water keeps rising. By the end, some residents have left, some have built rafts, some have started feeding you. That's the game.

**Reference points worth naming.** *Timberborn* (beaver city-builder, top-down, mechanically adjacent but tonally and perspectivally different — they're doing strategy, we're doing sim). *Untitled Goose Game* for the small-animal-vs-manicured-human-space loop. *A Short Hike* for the cozy ambient register. *Disco Elysium*, distantly, for how environmental storytelling carries narrative weight without cutscenes.

---

## 2. Strategic Decision: Two Modes vs. Two Acts

The pivotal call before anything else.

**Option A: Two modes.** Menu select between *The Pond* (Mode A, finite cozy sandbox) and *The Watershed* (Mode B, this doc). Players can pick either; they share assets but not save state. Cleaner separation, easier to ship Mode A first, more flexibility for future modes.

**Option B: Two acts.** One playthrough. The pond is the prologue and tutorial — you learn to fell, drag, dam, swim. Around the pond's edge, surveyor stakes appear. Then construction noise. Then houses. Then water in the wrong places. The transition is the game's central story beat.

**Recommendation: B, with A as a fallback if scope balloons.** The Act II framing is mechanically nearly identical to the mode-select version — you can always splice Mode A out as a standalone tutorial level later. But it gives the suburb mode something it desperately needs: *standing*. You're not a mischief-beaver. You're a beaver whose pond got smaller. The flooding stops being prank and becomes consequence.

The cost is one more ADR's worth of state-management complexity (saves carry across acts) and a transition sequence that's nontrivial to author. Worth it.

This decision blocks asset pipeline work — Mode B needs roughly 4× the asset variety of Mode A. We should make the call before Phase 1.

---

## 3. Pillars (extending Mode A)

All three Mode A pillars carry forward unchanged. Two additions specific to this mode:

**P4. Time is the antagonist, not humans.** The pressure isn't *being caught* — it's the limited twilight window. Humans during the day are weather, not enemies. They patch what you broke; they don't hunt you. Stealth is not a mechanic. Twilight pacing is.

**P5. The world keeps score, the UI doesn't.** No flood-progress bar. No "houses submerged: 4/12." The water level on the cul-de-sac sign is the progress bar. The empty driveway where the Subaru used to be is the progress bar. We commit to environmental storytelling and accept that some players won't see all of it.

---

## 4. Core Loop

```
DAWN (20 min)         → DAY (timelapse, ~30s)        → DUSK (20 min)        → NIGHT (timelapse, ~30s)
─────────────         ───────────────────             ─────────────         ──────────────────
player active         human reactions:                player active         passive water flow
beavers visible       - clear blockages?              beavers visible       small wildlife shifts
water rises slowly    - call animal control?          water rises slowly    new dawn assets ready
new sticks spawn      - build sandbags?                                     
                      - leave?
                      newspaper updates
                      water continues to flow
```

**Within a twilight window**, player actions:
- Fell trees (tree-by-tree, slow, audible)
- Drag logs along learned paths
- Place sticks and mud into damming locations
- Bypass or sabotage human countermeasures (gnaw through a sandbag, divert a culvert)
- Discover narrative beats (a left-out note, a kid's chalk drawing, a "for sale" sign that wasn't there yesterday)

**Across the day-night boundary** the world changes without the player. This is where the slow-sim feel comes from. You wake at dusk to a world that moved while you slept.

**Across many days**, the suburb transforms:
- Lawns become marshes
- Streets become canals
- Parked cars become reefs
- New wildlife arrives (frogs first, then ducks, then a heron)
- Some residents leave; some adapt; one or two become allies

There is no fail state and no win state — only an emergent equilibrium that varies per playthrough. A natural ending point arrives when the player feels the suburb has become the wetland again. We provide soft endings (an epilogue triggered by water-coverage thresholds + days elapsed) but don't gate them.

---

## 5. Mechanics

The mechanic list stays small on purpose. Each one needs to be *good*, not just present.

**Felling.** Hold to gnaw, tree falls in the direction of your last bite. Trees take 30–90 seconds depending on species. Fallen trees become 2–5 logs depending on size. Felling is loud — nearby NPCs notice in the morning.

**Hauling.** Logs are slow to drag on land, fast in water. The river/canal network is the highway. This makes water expansion *strategically* useful, not just thematically — every flooded street is a new shipping lane.

**Damming.** Place sticks at flow-restriction points (culverts, low spots, narrow channels). Dams have integrity that depends on stick count, mud, and current pressure. Humans can disassemble them during the day; if you build them strong overnight, they hold.

**Diving and traversal.** Beavers in water move fast and are invisible to NPCs. Beavers on land are slow and conspicuous. The water-vs-land choice shapes every route.

**Tail slap.** Doubles as a save-game and a "rally colony" command. Symbolic, tactile, satisfying. Not strictly necessary — we may scope it out — but worth prototyping.

**Diversion sabotage.** Late-game tool: gnaw a hole in a fence to redirect runoff, knock over a flowerpot to clog a storm drain. These are one-shot environmental edits with disproportionate flood effect.

What we are *not* implementing: combat, hunger, fatigue, currency, skill trees, crafting menus. The temptation will be strong. Resist.

---

## 6. The MPC: Willow Bend

The setting is a character. Worth designing properly.

**Geography.** A horseshoe-shaped development of ~30 lots around a man-made retention pond (which is, unbeknownst to the developers, sitting on the original beaver pond's outflow). Cul-de-sacs branch off a single arterial road. A creek runs through a "greenbelt easement" along the north edge — this is your highway in.

**Topology matters mechanically.** The flood sim is just a height field. Lots downhill from the creek flood first. The HOA president's lot — naturally — is on the highest ground, which is its own joke.

**Residents (~8–12 named, the rest ambient).** Each named household has:
- A house archetype (one of 6 procedural variants)
- A landscaping signature (rose garden, immaculate lawn, "natural" xeriscape, abandoned-looking)
- A schedule (when they're home, when they leave for work)
- A reaction profile (panicker, fixer, denier, ally, observer)
- One narrative thread that plays out over ~10–20 in-game days

We don't render residents as full 3D characters — they're silhouettes in windows, sounds, notes. This is both a stylistic choice and an enormous scope save. Their *houses* are the characters. The Subaru station wagon at lot 14 acquires more pathos than any face we could model.

**The HOA newsletter.** Updates every 2–3 days. It's the closest thing to direct narrative the player gets. Tone is bureaucratic-cheerful curdling into bureaucratic-panicked. Written as if the residents are the protagonists of their own story (because they are).

---

## 7. Story Architecture

Sandbox-driven, not branching. The narrative engine is:

1. **Background pressure.** Time passes. The HOA newsletter exists. Seasons change.
2. **Threads.** Each named household has a thread that plays out independently — *for sale* sign goes up, kid starts leaving carrots on the porch, husband builds a kayak in the garage. Threads advance based on local water levels at that lot, not global progress.
3. **Setpieces.** A handful of authored moments triggered by world state: the first time a road floods, the first dam that survives a day's clearing, the first NPC who leaves food. These are paced by elapsed days + thresholds, not scripted sequence.
4. **Wildlife return.** The ecological narrative — frogs, then ducks, then dragonflies, then a single great blue heron — is the player's reward feedback loop. Hard to overstate how satisfying this should feel.

What we don't do: branching dialogue, choices with consequences, named villains, climactic confrontations. The player makes a thousand small choices about where water goes; the world responds in kind. That's the story.

---

## 8. Asset Pipeline Implications (Important)

This is where the AI asset pipeline either pays for itself or doesn't.

**Mode A** needed maybe 40 unique assets (trees, rocks, sticks, lodge parts, fish, ambient props). **Mode B** needs roughly 200 — and most of those are *variants*, which is exactly what the Sculptor + MaterialArtist sub-agent split is designed for.

New asset categories specific to Willow Bend:

| Category | Count (approx) | Notes |
|---|---|---|
| House archetypes | 6 base × 4 variants | Procedural placement, swappable trim/paint |
| Lawn ornaments | 20–30 | Flamingos, gnomes, mailboxes, gazing balls — comedic anchors |
| Vehicles | 6 archetypes × 3 paint | Parked, drivable-away, eventually submerged states |
| Suburban infra | 30+ | Hydrants, signs, culverts, light posts, storm drains |
| Landscaping | 15+ | Hedges, planted ornamentals, mulch beds, rose bushes |
| Wet-state variants | 1 per submersible asset | Each asset needs a "half-submerged" and "fully submerged" appearance |
| Beaver-modified | 10+ | Damming materials, gnawed-stump variants |

**The wet-state requirement is the hidden cost.** Every asset that can go underwater needs at least two appearance states — the more we can do this with shader variants instead of geometry variants, the better. ADR worth writing.

**This is also where the pipeline wins big.** A request like *"generate 4 variants of a 1990s ranch house with attached garage, vinyl siding in cream/sage/beige/gray, with procedurally-placed windows and a 30% chance of an attached deck"* — that's exactly the prompt the Sculptor was designed for. The MPC's cookie-cutter authenticity is *easier* to generate than artisanal variety. The aesthetic and the tooling are aligned.

---

## 9. Technical Additions (beyond Mode A)

**Water simulation.** The big one. Not full fluid sim — too expensive in WebGL. Approach: a 2D height-field cellular automaton on a grid (probably 1m resolution over a ~200m × 200m playable area = 40k cells). Each tick, cells equalize with neighbors based on terrain height + dam blockages. Runs at simulation tickrate (10 Hz), not framerate. Visual water surface is a shader displaced by the height field.

This is the single largest technical risk in Mode B. Worth a dedicated spike before committing.

**NPC behavior system.** Not full AI — schedule-driven state machines per household. ~12 active households × 5 states = something a single TypeScript file can hold. Behaviors are reactive (water at my driveway → switch to "panicked" state), not planning.

**Persistent world state.** Mode A could get away with localStorage and a flat JSON blob. Mode B has too much state for that to be sane — consider IndexedDB with a structured schema, or compressed serialized snapshots. Save-on-twilight-end is the obvious cadence.

**Timelapse rendering.** The day/night transitions need to *feel* like compression of real time, not a black fade. Probably: accelerated time-of-day shader + cached "day events" that play out as quick beats during the timelapse. This is a polish item but it's the polish that sells the whole loop.

---

## 10. Roadmap Adjustment

If we adopt the Act II framing, the Mode A roadmap is unchanged through Phase 4. New phases append:

**Phase 5 — Suburb spike (3–4 weeks).** Water height-field sim, one procedurally-generated house, three lot terrain. Gate: water flowing from the pond submerges a driveway in real time.

**Phase 6 — Willow Bend full layout (4–6 weeks).** All 30 lots, named households, NPC schedules, HOA newsletter system.

**Phase 7 — Threads and setpieces (3–4 weeks).** Named household stories, wildlife return, soft endings.

**Phase 8 — Polish and ship.** Same as Mode A's Phase 5, larger surface area.

Total to Mode B playable: another ~10–14 weeks beyond Mode A. The asset pipeline work front-loaded in Mode A is what makes this tractable.

---

## 11. Risks and Open Questions

**Water sim is the technical hinge.** If the height-field approach feels bad, the whole mode falls apart. Spike this *before* committing to Phase 5 scope.

**Authoring vs. emergence balance.** Pure emergence produces shapeless playthroughs. Heavy authoring kills replayability. The named-household-threads approach tries to split the difference; we won't know if it works until we have three or four threads playable.

**Scope discipline on residents.** The temptation will be to give every household a thread. The discipline is: ~10 named, the rest ambient. Mode A's "place over progression" pillar applies — Willow Bend is the protagonist, not its residents.

**MPC means Master Planned Community.** Confirming the read because the acronym overloads. If you meant something else (Multi-Purpose Community? Mid-Priced something?), the doc needs adjusting.

**Open questions worth a flag:**
- Does the player ever see another beaver? (Solo beaver vs. colony — narrative implications either way.)
- Can NPCs leave permanently, and does the empty house then feel haunted?
- Is there ever a winter? (Major scope addition; major thematic payoff.)
- Do we want a "patron" NPC who actively helps the beavers — the kid who leaves carrots — or does that lean too sentimental?

---

## Next Concrete Step

Decide A vs B (mode-select vs. act-progression). The decision unblocks asset pipeline scoping and save-state architecture. Everything else can wait one more week.

Beyond that: Mode A Phase 0 spike is still the only thing actually generating code. Don't let Mode B planning crowd that out — this doc is reference, not work.
