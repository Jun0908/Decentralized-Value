import Image from "next/image";
import styles from "./arena-intro-story.module.css";

const stories = {
  "calldata-compression": {
    image: "/images/calldata-packing-story.png",
    alt: "A data-packing workshop compresses a bulky batch into a small package, then checks the decoded contents.",
    title: "Pack smaller. Restore exactly.",
    premise:
      "Ethereum charges for the data you send and the work needed to read it. Smaller packages can take more work to unpack.",
    steps: [
      ["Choose the packing rules", "Pick a codec for each kind of batch."],
      ["Send less. Decode correctly.", "Every transfer must survive packing unchanged."],
      ["Compare both gas costs", "Sending cost and decoding cost stay separate."],
    ],
    boundary:
      "Concept illustration, not a measured batch. The lab below runs real EVM checks; no transaction is sent.",
  },
  "microgrid-dispatch": {
    image: "/images/microgrid-community-story.png",
    alt: "Solar panels and wind turbines feed a battery and a community while a storm interrupts the outside electricity grid.",
    title: "The grid goes down. Can your town stay lit?",
    premise:
      "Save battery power for an outage, use it now, or buy electricity from the grid. Every choice changes the day ahead.",
    steps: [
      ["Set your energy policy", "Choose when to charge, discharge, and buy power."],
      ["Run a changing day", "Follow six turns of weather, demand, and grid outages."],
      ["See what you traded off", "Cost, unmet demand, and carbon stay separate."],
    ],
    boundary:
      "Concept illustration. The day is a deterministic simulation, not a live electricity network.",
  },
  "secret-gate": {
    image: "/images/secret-gate-membership-story.png",
    alt: "A locked identity vault stays private while a membership proof opens a community gate; a reused proof is blocked.",
    title: "Prove you belong. Keep your identity private.",
    premise:
      "The gate needs proof that you are a member—not your secret identity. The same proof cannot open this gate twice.",
    steps: [
      ["Create a private identity", "Only its public commitment joins the group."],
      ["Make a membership proof", "Your browser proves membership without sending the secret."],
      ["Enter once. Test reuse.", "The server verifies the proof and rejects a second use."],
    ],
    boundary:
      "Concept illustration. Real proof demo below; the latency / memory competition remains PIVOT.",
  },
} as const;

export function ArenaIntroStory({ slug }: { slug: string }) {
  if (!Object.hasOwn(stories, slug)) return null;
  const story = stories[slug as keyof typeof stories];
  return (
    <figure
      className={styles.story}
      data-testid="arena-intro-story"
      aria-labelledby={`${slug}-story-title`}
    >
      <Image
        src={story.image}
        alt={story.alt}
        width={1536}
        height={1024}
        sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1280px) 58vw, 720px"
        loading="eager"
        className={styles.image}
      />
      <figcaption className={styles.copy}>
        <p className={styles.eyebrow}>THE IDEA IN ONE PICTURE</p>
        <h2 id={`${slug}-story-title`}>{story.title}</h2>
        <p className={styles.premise}>{story.premise}</p>
        <ol className={styles.steps}>
          {story.steps.map(([title, description], index) => (
            <li key={title}>
              <span className={styles.number} aria-hidden="true">
                0{index + 1}
              </span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.boundary}>{story.boundary}</p>
      </figcaption>
    </figure>
  );
}
