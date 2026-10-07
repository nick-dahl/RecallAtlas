# Great Paintings course: design spec

**Date:** 2026-10-07
**Status:** Design agreed in an iterative Q&A with the user. Spec and painting list (`2026-10-07-great-paintings-list.md`) approved 2026-10-07.
**Parent spec:** `2026-10-01-recall-atlas-design.md`. Everything there applies unless this spec overrides it. US Presidents (`2026-10-05-us-presidents-design.md`) is the closest precedent: image items, typed names, multiple-choice categories.

## 1. Summary

Great Paintings is a course of about **240 of the most famous and consequential paintings** in history, all in the public domain. A learner who finishes it can:
- **Name a painting** from its image.
- **Name its artist** from its image.
- **Pick the painting** from its title.
- **Name its movement or period** from its image.

The set is mostly Western, from about 1300 to 1930. About 30 landmark works come from other traditions. There is **one item per painting** and each has **4 prompts**, so about 960 prompts in total. New paintings are introduced **most famous first**. The course home is a **gallery wall** grouped by movement.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| G1 | Goals | Image → title, image → artist, title → image, image → movement. Date and museum are not quizzed |
| G2 | Copyright | Public-domain works only: published before 1931 (US rule). Images are public domain or CC0, or for works photographed in place (caves, frescoes, murals) CC BY / CC BY-SA with credit on a credits page |
| G3 | Movements | About 20 Western movements plus about 4 for other traditions (§3.2). Each painting has one label. Boundary labels are never offered as wrong answers |
| G4 | Typing | Title and artist are both typed at level 3, with forgiving matching (§3.3) |
| G5 | Selection | Claude drafts a balanced list for the user to edit (§3.1). At most 4 works per named artist |
| G6 | Learning order | Most famous first, then descending fame, across all movements |
| G7 | Course home | Gallery wall by movement, with a click-to-enlarge reference view |
| G8 | Breadth | Mostly Western, plus about 30 landmark works from other traditions, chosen for fame, relevance and interest |
| G9 | Anonymous works | Included where significant, with "Anonymous" as the correct artist. At most about 8, with safeguards (§4.3) |
| G10 | Placement | Typed title. A correct answer fast-tracks both title prompts. Artist and movement start learning at level 2 |

## 3. Content and data

### 3.1 The painting list

- **Size:** about 240 works.
  - About 210 are Western, roughly 1300–1930.
  - About 30 come from other traditions: Chinese, Japanese, Persian and Mughal, Indian, and ancient or medieval works outside Europe.
- **Balance:**
  - At most **4 works per named artist**.
  - At least **about 6 works per movement**, so each movement's questions have substance.
  - At most **about 8 anonymous works**.
- **Sources for fame and significance:** Gombrich's *The Story of Art*, Smarthistory, major museum highlight lists, and how often a work appears in survey texts.
- **Public domain (G2):** every work was published before 1931. Its image comes from Wikimedia Commons or a museum open-access collection, marked public domain or CC0. Works photographed in place (caves, frescoes, murals on curved walls) may instead use a CC BY or CC BY-SA photo, credited by author and licence on the credits page. A work with no such source is dropped.
- **Media:**
  - Paintings in any medium are included: panel, canvas, fresco, mural, scroll, album leaf, manuscript painting.
  - Woodblock prints are allowed only within Japanese ukiyo-e (Hokusai, Hiroshige).
- **Review gate:** before any image is fetched, Claude writes the full draft list as a document for the user to edit. The document gives each work's rank, title, artist, year, movement and museum, plus the per-movement and per-artist counts. Building starts only from the approved list.

**Each painting records:**

| Field | Example | Use |
|---|---|---|
| `key` | `mona-lisa` | Internal id. Never shown in a question |
| `title` | *Mona Lisa* | Main title. Unique within the set |
| `titleAliases` | *La Gioconda*, *La Joconde* | Accepted typed titles |
| `artist` | Leonardo da Vinci | Full name, or `Anonymous` |
| `artistAliases` | Leonardo, da Vinci | Accepted typed artist forms (§3.3) |
| `year` | c. 1503–1519 | Display text only |
| `movement` | High Renaissance | One label from §3.2 |
| `alsoMovements` | — | Boundary labels never offered as wrong answers (e.g. Manet: Impressionism) |
| `museum` | Louvre, Paris | Reference views only |
| `fame` | 1 | Learning order (G6) |
| `image` | Commons file page, licence, optional detail crop | §3.4 |
| `lookalikes` | other Leonardo works, other Renaissance portraits | Hard distractors (§3.5) |

**Unique titles:** generic titles get their conventional distinguishing name, e.g. *Self-Portrait with Bandaged Ear*, *Madonna of the Meadow*, *Water Lilies (1906)*. The title → image question shows only the title, so it must identify one painting.

### 3.2 Movements (learning groups)

There are about 24 labels. Each is a gallery-wall "room" on the course home. The draft list confirms the final set.

**Western (about 20), in chronological order:**
1. Gothic & Proto-Renaissance
2. Early Renaissance
3. Northern Renaissance
4. High Renaissance
5. Venetian Renaissance
6. Mannerism
7. Baroque
8. Dutch Golden Age
9. Rococo
10. Neoclassicism
11. Romanticism
12. Realism
13. Pre-Raphaelite
14. Impressionism
15. Post-Impressionism
16. Symbolism & Art Nouveau
17. Fauvism
18. Expressionism
19. Cubism & Futurism
20. Abstraction

**Other traditions (about 4):**
- Ancient & Medieval: e.g. the Fayum portraits and Ajanta murals.
- Chinese painting.
- Japanese painting & ukiyo-e.
- Persian & Mughal miniature.

**On the course home**, rooms appear in chronological order by each movement's typical date, with the non-Western rooms placed by date among them.

**Learning order is separate from rooms:**
- Every item has the same `groupOrder`, and `itemOrder` is its fame rank.
- The engine's existing "group order, then item order" sort therefore introduces paintings most famous first, across all movements.
- The course home groups by `group` (the movement) using its own chronological room order.

### 3.3 Typed answers

**Both fields:**
- Case, accents and punctuation are ignored, and a leading "The", "A" or "An" is ignored.
- Small typos pass, with a note, under the existing typo rules.

**Titles:**
- The main title or any `titleAliases` entry is accepted.
- Aliases cover common English, original-language and short forms. Examples: *The Night Watch*; *Sunday Afternoon on the Island of La Grande Jatte* / *A Sunday on La Grande Jatte*.

**Artists:**
- The full name or any `artistAliases` entry is accepted.
- **Surname alone:** accepted wherever it is unique in the set ("Vermeer", "Gogh" or "van Gogh").
- **Conventional single names:** accepted: "Rembrandt", "Raphael", "Titian", "Giotto", "Caravaggio", "Leonardo".
- **Shared surnames** (Bruegel the Elder and Younger, any two Holbeins) need the distinguishing part. A shared bare surname is ambiguous: always wrong and never a mix-up. This is how "Adams" works in Presidents.

**"Anonymous" and "unknown":**
- Correct for anonymous works.
- Wrong for named works, and never recorded as a mix-up.

### 3.4 Images

- **Fetch once and commit the result.**
  - A separate script, `npm run content:paintings`, downloads each file listed in the data.
  - It applies the optional detail crop, otherwise keeping the whole painting uncropped.
  - It writes two webp files per painting: `content/paintings/<key>.webp` at about 900 px on the long side, and `<key>-thumb.webp` at about 320 px.
  - It never runs at request time or in `content:build`.
- **Detail crops** are only for works too large to read whole, e.g. *The Creation of Adam* from the Sistine ceiling, or one panel of a triptych. Views mark them with a small "Detail" badge.
- **Provenance:** each entry records its source page URL, licence and, for CC BY / CC BY-SA photos, the photographer. A generated `content/paintings/CREDITS.md` lists them, and a public **Credits** page (linked from the course home) shows the same list, so attribution licences are met.
- **Size budget:** the large image is at most about 150 KB and the thumbnail at most about 30 KB. The build fails if either is exceeded.
- **In questions**, images are embedded data URIs with empty `alt` text, like flags and portraits, so no URL or file name reveals the answer.
- **Reference views** (course home, enlarged view) may use a public image route like `portrait-art`. That route is never used inside a question.

### 3.5 Look-alikes (hard distractors)

- Claude drafts look-alikes with the list:
  - other works by the same artist;
  - works with a similar subject or composition: Madonnas, *Water Lilies*, self-portraits, Annunciations, landscapes of the same school;
  - works of the same movement that people commonly confuse.
- Personal mix-ups come first, as in every course.

### 3.6 Validation (fails the build)

- **Records:**
  - Every painting has an image file and thumbnail within budget.
  - Every painting has a unique title (after normalization) and a movement from §3.2.
  - Every `alsoMovements` label is a real movement other than its own.
- **Limits:**
  - At most 4 works per named artist.
  - At most 8 anonymous works.
  - Every movement has at least 6 works (the threshold can be lowered per movement if the approved list needs it).
- **Typed answers:**
  - No title alias equals another painting's title or alias.
  - No artist alias resolves to two different artists unless it is listed as ambiguous.
- **Copyright:** every image source records a licence of public domain, CC0, CC BY or CC BY-SA. CC BY and CC BY-SA sources also record an author. Every work's year is before 1931.

## 4. Prompts, levels, formats

### 4.1 Prompt types

| Prompt | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| `image_to_title` | 4 titles, same movement | 6 titles, hard | typed title |
| `image_to_artist` | 4 artists | 6 artists, hard | typed artist |
| `title_to_image` | 4 images | 6 images, hard | 8 images, hard |
| `image_to_movement` | 4 movements | 6 movements | 6 movements, neighbours |

- **`image_to_artist`:** `answerField: 'artist'` and `distinctChoices`. No artist appears twice, and no option is an artist the target also accepts.
- **`image_to_movement`:**
  - `answerField: 'movement'`, `distinctChoices`, multiple choice only, `recordsConfusions: false`.
  - The target's `alsoMovements` are never offered.
  - At level 3, "neighbours" means the movements closest in the §3.2 order, e.g. Impressionism alongside Post-Impressionism, Realism and Symbolism.
- **Choice labels:** a multiple-choice title option shows only the title. An artist option shows only the artist.

### 4.2 Mix-ups

- **Titles (both directions):** picking or typing another painting's title records a mix-up with that painting.
- **Artists:** a picked or typed artist resolves to one of that artist's works in the set:
  - their only work, if they have one;
  - otherwise the one that is a look-alike of the target;
  - otherwise none.

  If none applies, nothing is recorded.
- **Movements:** never recorded.
- **Contrast drills** work as in every course. Two paintings mixed up twice produce an "easy to mix up" card:
  - the two paintings side by side, each with title, artist and year;
  - then "Which one is *X*?" with the two images.

### 4.3 Anonymous works

- Anonymous works have `artist: Anonymous`. The per-artist cap does not apply to them.
- **Guessing safeguard:** on multiple-choice artist questions about named works, "Anonymous" appears as a distractor at roughly the rate it appears as the correct answer on anonymous works. Its presence alone never signals the answer. A seeded statistical test checks this.
- **Distinct choices:** "Anonymous" is one label, so it never appears twice in one question.
- **Mix-ups:** choosing "Anonymous" for a named work records no mix-up.

### 4.4 Placement

- **Format:** the typed title (`image_to_title` at level 3), over a sample of paintings in fame order. This uses the existing placement flow.
- **A correct answer** graduates `image_to_title` and `title_to_image` (`placementGraduates`).
- **Engine addition (opt-in):** the item's other prompts, artist and movement, start **learning at level 2**. They skip the intro card and level 1.
  - This is a new optional course field, e.g. `placementHeadStart: 2`. Courses without it are unchanged.
  - Tests cover the new path and confirm the other courses behave as before.
- **A wrong answer** leaves the painting new.

### 4.5 Exam and practice ahead

- **Final exam:** each painting asked once at level 3, with prompt types mixed as in the other courses. The pass mark is unchanged.
- **Practice ahead:** works unchanged.

### 4.6 Leak rules

- **Image → title / artist / movement views:** they contain the image and no title, artist, movement, year or museum outside choice labels.
- **Title → image views:** they contain the target's title and unlabelled images. They contain no artist and no other title.
- **Everywhere:**
  - Images are data URIs with empty `alt` text.
  - No view contains item keys or image file names.
- **A test checks every painting**, in every prompt type, at every level.

## 5. Engine and service changes

- **Engine:**
  - `placementHeadStart` (§4.4), opt-in.
  - The "Anonymous" distractor rate (§4.3). It lives in distractor selection for the artist field, or in the paintings presenter's issue path. The plan decides where, keeping it opt-in.
  - Artist mix-up resolution (§4.2).
- **Grading:** forgiving matching, ignoring leading articles and accents, if the existing normalizer doesn't already. "Anonymous" and shared bare surnames must be correct for their own items yet ambiguous elsewhere. The existing `ambiguousAnswers` check must not reject an answer that the target itself accepts.
- **Presenter:** `paintingsPresenter`, wired in `lib/study/presenters.ts`. Its `item()` returns title, artist, year, movement, museum, image and thumbnail, for intros, feedback and end screens.
- **Everything else stays as it is:** sessions, FSRS, readiness, the exam and practice ahead.

## 6. UI

- **Painting frame:** a component that shows a painting uncropped, letterboxed on a neutral mat, with an optional "Detail" badge.
  - In questions it is at most about 50% of viewport height.
  - On cards and in grids it is the thumbnail.
- **Questions:**
  - Image → title, artist and movement show the painting above the existing text choices or typed input.
  - Title → image shows the title above an image grid: 2 columns on phones, 3–4 wider.
- **Intro card:** the large painting, the title, "Artist, year", the movement, and the museum and city.
- **Feedback:**
  - A thumbnail and the fact: "*The Night Watch* is by Rembrandt (1642), Dutch Golden Age".
  - On a miss that resolved to another painting: "You named *The Anatomy Lesson of Dr Tulp*" with its thumbnail.
  - The typo note shows as in other courses.
- **Course home: gallery wall:**
  - **Rooms:** one per movement, in chronological order, each a wall of thumbnails.
  - **Progress:** greyed out when new, colour as it is learned, a gold frame when mastered. This is the same tile states as the Presidents timeline.
  - **Labels:** title and artist under each thumbnail once the painting has been introduced. Before that, the image shows unlabelled.
  - **Hover:** a summary of progress on each prompt, as on the mastery map.
  - **Click:** opens a larger reference view with title, artist, year, movement and museum. Unintroduced paintings open the larger image without labels.
  - **Reused panels:** readiness meter, mix-ups and last exam.
- **Copy:**
  - The course blurb is "240 of the world's great paintings: title, artist and movement". The exact number comes from the approved list.
  - The landing page lists the course like the others.

## 7. Testing

- **Content:**
  - The §3.6 validations.
  - A test that the learning order is fame order across movements.
- **Leak rules:** every painting × 4 prompts × 3 levels (§4.6).
- **Grading:**
  - Titles: aliases, leading articles, accents, typos.
  - Artists: surnames, single names, shared surnames (ambiguous).
  - "Anonymous": correct on its own works, wrong and not a mix-up elsewhere.
  - Artist mix-up resolution.
  - Movement exclusions.
- **Engine:** `placementHeadStart` (new path, and other courses unchanged), and the Anonymous distractor rate (seeded statistical test).
- **Simulation:** a learning simulation like the other courses, with an observed floor.
- **Integration (Supabase):** placement through to exam-ready, the readiness total, a full exam and practice ahead.
- **End-to-end:**
  - Enrol from the dashboard.
  - The gallery wall shows all paintings unlabelled.
  - Placement with one deliberate miss, checking the feedback.
  - Study every prompt type, including typed title and artist.
  - Pass the exam, then do practice ahead.
- **Visual check:** a phone-width screenshot pass over every screen.

## 8. Out of scope

- Works after 1930, or any work without a clean public-domain image.
- Quizzing year, date order or museum. They appear only as reference.
- Recognizing an artist's style on works not in the set.
- Sculpture, architecture, and prints other than ukiyo-e.
- Audio or extended descriptions of works.
