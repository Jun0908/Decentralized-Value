# 下段3 Arena — Illustration assets

2026-09-13。組み込み image_gen で生成。既存の災害対応イラストの暗い立体地形・limeの流れに合わせた。文字は画像に焼き込まずHTMLで表示する。実測Evidenceではなく概念説明。

保存先（全て1536×1024 PNG）:

- `apps/web/public/images/calldata-packing-story.png`
- `apps/web/public/images/microgrid-community-story.png`
- `apps/web/public/images/secret-gate-membership-story.png`

表示: `apps/web/src/components/arena-intro-story.tsx`。既存ArenaPageShellから対象3Slugのみへ表示。評価処理・API・PIVOT判断は不変。

## 最終生成Prompt

### calldata

Use case: illustration-story. Asset type: wide landscape 1536x1024 website arena introduction illustration. Create a polished isometric miniature diorama, semi-realistic painted 3D concept illustration, dark navy charcoal background, luminous lime green routes, warm tiny lights, restrained cyan accents. Match the mood of a disaster-response strategy map: tangible objects and instantly readable cause and effect, not abstract floating hexagons. Generous outer margin, large readable subjects, no text, no letters, no numbers, no watermarks. This is explanatory concept art, not a screenshot or actual measured result. Subject: data compression as a miniature futuristic packing workshop. Left: a large tray containing a tidy repeated sequence of blue and amber data tiles. Center: a compact mechanical packing station with a visible choice of wide simple lane versus narrow tightly packed lane; lime arrows carry the data toward a small tightly packed capsule. Right: a verification machine unpacks the capsule back into the exact same ordered blue and amber tile sequence seen at the start, beside a luminous green check symbol. Make original bulk, small package, and identical restored contents the three main focal elements. No tokens or money or blockchain logos.

### microgrid

Use case: illustration-story. Asset type: wide landscape 1536x1024 website arena introduction illustration. Create a polished isometric miniature diorama, semi-realistic painted 3D concept illustration, dark navy charcoal background, luminous lime green routes, warm tiny lights, restrained cyan accents. Match the mood of a disaster-response strategy map: tangible objects and instantly readable cause and effect, not abstract floating hexagons. Generous outer margin, large readable subjects, no text, no letters, no numbers, no watermarks. This is explanatory concept art, not a screenshot or actual measured result. Subject: a community electricity strategy game. A compact town of homes and a clinic on the right, solar panel field and two wind turbines on the left, a large battery storage cabinet in the center, all connected by visible lime glowing energy paths. Sunny clear sky over solar farm transitions to storm clouds over a distant utility pylon with a visibly broken incoming connection. Battery still feeds the glowing homes despite the grid outage. Show the entire miniature landscape with all three energy sources and town large enough to identify immediately. No people necessary, no disaster destruction, no impossible perpetual energy loops.

### secretgate

Use case: illustration-story. Asset type: wide landscape 1536x1024 website arena introduction illustration. Create a polished isometric miniature diorama, semi-realistic painted 3D concept illustration, dark navy charcoal background, luminous lime green routes, warm tiny lights, restrained cyan accents. Match the mood of a disaster-response strategy map: tangible objects and instantly readable cause and effect, not abstract floating hexagons. Generous outer margin, large readable subjects, no text, no letters, no numbers, no watermarks. This is explanatory concept art, not a screenshot or actual measured result. Subject: anonymous membership proof as an elegant private entrance scene. Left: a person beside their closed personal identity vault with a visible lock; private contents never leave. Center: their small glowing proof ticket travels on a lime path to a scanner built into an entrance gate, while a small board of anonymous identical member symbols sits behind the scanner. Right: the green-lit gate allows a faceless visitor to enter a small community courtyard. A separate faded duplicate of the used ticket is blocked by a small red stop marker before the scanner. Main story is a locked identity, proof ticket and verified entry, not hacking. No faces, passports, names or readable personal data. Do not imply on-chain payment or reward.

### Secret Gateの修正

生成後、金庫が開いていたため組み込み image_gen で局所編集: Change only the personal identity vault at the left: fully CLOSE and LOCK its heavy door so none of its contents or portrait are visible. Preserve all other scene elements, composition, people, proof tickets, green route, scanner, courtyard, style, size, lighting and colors exactly. No text.
